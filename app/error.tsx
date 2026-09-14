'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App runtime error:', error)
  }, [error])

  const handleClearAndReload = () => {
    try {
      localStorage.removeItem('sobinote-session')
      sessionStorage.clear()
    } catch { /* ignore */ }
    window.location.reload()
  }

  return (
    <main className="auth-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <section className="auth-card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1d1d1f' }}>
          페이지를 불러오는 중 문제가 발생했습니다
        </h2>
        <p className="muted" style={{ fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1.5rem', color: '#86868b' }}>
          일시적인 오류일 수 있습니다. 다시 시도하거나 캐시를 초기화해 보세요.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button
            type="button"
            className="primary-btn"
            style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', background: '#0071e3', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => reset()}
          >
            다시 시도하기
          </button>
          <button
            type="button"
            className="small-btn"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', background: '#f2f2f7', color: '#1d1d1f', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            onClick={handleClearAndReload}
          >
            세션 캐시 초기화 후 새로고침
          </button>
        </div>
      </section>
    </main>
  )
}
