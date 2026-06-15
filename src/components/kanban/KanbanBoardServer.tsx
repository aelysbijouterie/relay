'use client'

import { KanbanBoard } from './KanbanBoard'

export function KanbanBoardServer({ currentDepartmentId, currentUserName }: {
  currentDepartmentId: string
  currentUserName?:    string
}) {
  return <KanbanBoard currentDepartmentId={currentDepartmentId} currentUserName={currentUserName} />
}
