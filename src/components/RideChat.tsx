import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ChatMessage {
  id: string
  user_id: string
  content: string
  created_at: string
  user?: { name: string | null; course: string | null; batch: string | null } | null
}

// Group chat for the poster and accepted riders (the database enforces who can read/post)
export function RideChat({ rideId, userId }: { rideId: string; userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('messages')
      .select('id, user_id, content, created_at, user:users(name, course, batch)')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true })
      .limit(300)
    if (loadError) {
      setError('Could not load the chat.')
      return
    }
    setMessages((data || []) as unknown as ChatMessage[])
  }, [rideId])

  useEffect(() => {
    void load()
    // New messages arrive instantly; a slow refresh covers any missed update
    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `ride_id=eq.${rideId}` },
        () => void load()
      )
      .subscribe()
    const timer = setInterval(() => void load(), 20000)
    return () => {
      clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [rideId, load])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    try {
      setSending(true)
      setError(null)
      const { error: sendError } = await supabase.from('messages').insert({ ride_id: rideId, user_id: userId, content })
      if (sendError) throw sendError
      setText('')
      await load()
    } catch {
      setError('Message not sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const initials = (name?: string | null) =>
    (name || 'S')
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  return (
    <section id="ride-chat" className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-secondary-900">
        <MessageCircle size={18} className="text-primary-600" /> Ride group chat
      </h2>
      <p className="mb-3 text-xs text-secondary-500">Only the poster and confirmed travellers can see this chat.</p>

      <div ref={listRef} className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-secondary-50 p-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-secondary-500">
            No messages yet. Say hi and agree on a meeting point!
          </p>
        )}
        {messages.map(m => {
          const mine = m.user_id === userId
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {initials(m.user?.name)}
                </span>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? 'rounded-br-sm bg-primary-600 text-white' : 'rounded-bl-sm bg-white text-secondary-900 shadow-sm'
                }`}
              >
                {!mine && (
                  <p className="text-xs font-semibold text-primary-700">
                    {m.user?.name || 'Student'}
                    {m.user?.course && ` · ${m.user.course}${m.user.batch ? ` ${m.user.batch}` : ''}`}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? 'text-primary-100' : 'text-secondary-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase()}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={1000}
          placeholder="Type a message..."
          className="!rounded-full"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  )
}
