import { describe, it, expect } from 'vitest'
import { isTaskVisibleTo } from '@/lib/tasks/visibility'
import type { Task } from '@/types'

const task = (created_by: string, ...assignees: string[]) => ({ created_by, assignees: assignees.map(id => ({ id })) }) as unknown as Task

describe('visibilité des cartes', () => {
  it('le créateur voit sa carte', () => expect(isTaskVisibleTo(task('u1'), { userId: 'u1' })).toBe(true))
  it('une personne assignée voit la carte', () => expect(isTaskVisibleTo(task('u1', 'u2'), { userId: 'u2' })).toBe(true))
  it('une personne non liée ne voit pas la carte (même service)', () => expect(isTaskVisibleTo(task('u1', 'u2'), { userId: 'u3' })).toBe(false))
  it('un compte boutique voit les cartes assignées à ses collaborateurs', () =>
    expect(isTaskVisibleTo(task('siege', 'membre1'), { userId: 'boutique', teamIds: ['membre1', 'membre2'] })).toBe(true))
  it('… mais pas celles d’un autre magasin', () =>
    expect(isTaskVisibleTo(task('siege', 'autre'), { userId: 'boutique', teamIds: ['membre1'] })).toBe(false))
})
