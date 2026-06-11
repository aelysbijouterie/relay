import * as React from 'react'

interface TaskAssignedEmailProps {
  assigneeName: string
  taskTitle: string
  taskDescription?: string | null
  priority: string
  deadline?: string | null
  departmentName: string
  departmentColor: string
  createdByName: string
  isCrossTeam: boolean
  appUrl: string
}

const PRIORITY_COLORS: Record<string, string> = {
  'Urgent':  '#EF4444',
  'Élevée':  '#F97316',
  'Moyenne': '#EAB308',
  'Faible':  '#6B7280',
}

export function TaskAssignedEmail({
  assigneeName,
  taskTitle,
  taskDescription,
  priority,
  deadline,
  departmentName,
  departmentColor,
  createdByName,
  isCrossTeam,
  appUrl,
}: TaskAssignedEmailProps) {
  const priorityColor = PRIORITY_COLORS[priority] ?? '#6B7280'

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Nouvelle tâche assignée — RELAYS</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8f7f5', fontFamily: "'DM Sans', Helvetica, Arial, sans-serif" }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#f8f7f5', padding: '40px 16px' }}>
          <tr>
            <td align="center">
              <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

                {/* Header */}
                <tr>
                  <td style={{ background: `linear-gradient(135deg, ${departmentColor}, ${departmentColor}99)`, padding: '28px 32px' }}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td>
                          <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 12px', marginBottom: 12 }}>
                            <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>RELAYS — {departmentName}</span>
                          </div>
                          <h1 style={{ margin: 0, color: '#ffffff', fontSize: 22, fontWeight: 700, lineHeight: 1.3, fontFamily: 'Georgia, serif' }}>
                            Vous avez été assigné(e) à une tâche
                          </h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={{ padding: '32px 32px 24px' }}>
                    <p style={{ margin: '0 0 24px', color: '#374151', fontSize: 15, lineHeight: 1.6 }}>
                      Bonjour <strong>{assigneeName}</strong>,<br />
                      <strong>{createdByName}</strong> vous a assigné(e) à la tâche suivante :
                    </p>

                    {/* Task card */}
                    <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: `4px solid ${departmentColor}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                      <h2 style={{ margin: '0 0 12px', color: '#111827', fontSize: 17, fontWeight: 600, lineHeight: 1.4 }}>
                        {taskTitle}
                      </h2>

                      {taskDescription && (
                        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
                          {taskDescription}
                        </p>
                      )}

                      <table cellPadding={0} cellSpacing={0}>
                        <tr>
                          <td style={{ paddingRight: 16, paddingBottom: 8 }}>
                            <span style={{ display: 'inline-block', backgroundColor: priorityColor, color: '#ffffff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                              {priority}
                            </span>
                          </td>
                          {isCrossTeam && (
                            <td style={{ paddingBottom: 8 }}>
                              <span style={{ display: 'inline-block', border: '1px solid #d1d5db', color: '#6b7280', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 999 }}>
                                🌐 Inter-équipes
                              </span>
                            </td>
                          )}
                        </tr>
                        {deadline && (
                          <tr>
                            <td colSpan={2}>
                              <span style={{ color: '#6b7280', fontSize: 13 }}>
                                📅 Échéance : <strong style={{ color: '#374151' }}>{new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                              </span>
                            </td>
                          </tr>
                        )}
                      </table>
                    </div>

                    {/* CTA */}
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                      <a
                        href={`${appUrl}/kanban`}
                        style={{
                          display: 'inline-block',
                          background: `linear-gradient(135deg, ${departmentColor}, ${departmentColor}bb)`,
                          color: '#ffffff',
                          textDecoration: 'none',
                          padding: '13px 32px',
                          borderRadius: 12,
                          fontSize: 14,
                          fontWeight: 600,
                          boxShadow: `0 4px 14px ${departmentColor}55`,
                        }}
                      >
                        Voir la tâche dans RELAYS →
                      </a>
                    </div>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '16px 32px', borderTop: '1px solid #e5e7eb' }}>
                    <p style={{ margin: 0, color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
                      RELAYS · Gestion de tâches Aelys · Ce message est automatique, ne pas répondre.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}
