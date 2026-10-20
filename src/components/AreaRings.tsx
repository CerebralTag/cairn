import { useState } from 'react'
import { PERIOD_WORDS, progressLabel } from '../goals'
import { areaCards, goalColourFor, goalDisplay, todayGoals, type AreaCard, type AreaGoal } from '../todayAreas'
import type { AppData } from '../types'

const RADIUS = 27
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// An area's ring: filled by the average progress of its goals; the middle says how many are met.
function AreaRing({ card, selected, onSelect }: { card: AreaCard; selected: boolean; onSelect: () => void }) {
  const filled = card.fraction * CIRCUMFERENCE
  return (
    <button
      className={selected ? 'area-ring on' : 'area-ring'}
      aria-pressed={selected}
      aria-label={`${card.name}, ${card.met} of ${card.total} done`}
      onClick={onSelect}
    >
      <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
        <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="var(--color-ring-track)" strokeWidth="7" />
        {filled > 0 && (
          // A zero-length arc with round caps would still draw a dot, so skip it.
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            stroke={card.colour}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            transform="rotate(-90 36 36)"
          />
        )}
        <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-text)">
          {`${card.met}/${card.total}`}
        </text>
      </svg>
      <span className="area-ring-name">{card.name}</span>
    </button>
  )
}

function Bubble({ on, colour, big }: { on: boolean; colour: string; big?: boolean }) {
  return (
    <span className={`bubble${on ? ' on' : ''}${big ? ' big' : ''}`} style={on ? { background: colour } : undefined}>
      {on ? '✓' : ''}
    </span>
  )
}

// One goal, drawn by what it is: a bar, a few bubbles, or a labelled bubble per task.
function GoalRow({ item, colour }: { item: AreaGoal; colour: string }) {
  const { goal, progress, steps } = item
  const display = goalDisplay(goal, progress)
  if (display === 'task') {
    return (
      <div className="goal-row">
        <div className="goal-row-head">
          <span className="goal-row-title">{goal.title}</span>
          {progress.met && <Bubble on colour={colour} />}
        </div>
      </div>
    )
  }
  const label = display === 'steps' ? `${progress.done} of ${progress.target}` : progressLabel(goal, progress)

  return (
    <div className="goal-row">
      <div className="goal-row-head">
        <span>
          <span className="goal-row-title">{goal.title}</span> <span className="muted period">{PERIOD_WORDS[goal.period].this}</span>
        </span>
        <span className="muted nowrap">
          {progress.met ? '✓ ' : ''}
          {label}
        </span>
      </div>
      {display === 'bar' && (
        <div className="goal-bar" role="img" aria-label={`${Math.round(progress.fraction * 100)} percent`}>
          <div className="goal-bar-fill" style={{ width: `${progress.fraction * 100}%`, background: colour }} />
        </div>
      )}
      {display === 'bubbles' && (
        <div className="bubbles" role="img" aria-label={`${Math.min(progress.done, progress.target)} of ${progress.target} done`}>
          {Array.from({ length: progress.target }, (_, i) => (
            <Bubble key={i} on={i < progress.done} colour={colour} />
          ))}
        </div>
      )}
      {display === 'steps' && (
        <div className="steps">
          {(steps ?? []).map((s) => (
            <span key={s.id} className="step">
              <Bubble on={s.done} colour={colour} big />
              <span className="step-name">
                <span className="sr-only">{s.done ? 'Done: ' : 'Not yet: '}</span>
                {s.title}
              </span>
            </span>
          ))}
          {(steps ?? []).length === 0 && <span className="muted">Tag repeatable tasks to this goal in Manage.</span>}
        </div>
      )}
    </div>
  )
}

// Today's goals: every goal for the week in one list, coloured by its area, with a ring per
// area (the ones switched on in Manage) above it as a summary. Tap a ring to narrow the list to
// that area (its to-dos join in); tap it again to see everything.
export function AreaRings({ data, now }: { data: AppData; now: Date }) {
  const cards = areaCards(data, now)
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const picked = cards.find((c) => c.key === pickedKey) // a ring that has since gone means "all"
  const everything = todayGoals(data, now)

  return (
    <div className="area-rings">
      {cards.length > 0 && (
        <div className="area-ring-row">
          {cards.map((card) => (
            <AreaRing
              key={card.key}
              card={card}
              selected={picked?.key === card.key}
              onSelect={() => setPickedKey(picked?.key === card.key ? null : card.key)}
            />
          ))}
        </div>
      )}
      <div className="area-goals" aria-label={picked ? `${picked.name} goals` : 'Goals'}>
        {picked
          ? picked.goals.map((item) => <GoalRow key={item.goal.id} item={item} colour={picked.colour} />)
          : everything.map((item) => <GoalRow key={item.goal.id} item={item} colour={goalColourFor(data.areas, item.goal)} />)}
        {picked?.tasks.map((t) => (
          <div key={t.id} className="goal-row">
            <div className="goal-row-head">
              <span className="goal-row-title">{t.title}</span>
              {t.done && <Bubble on colour={picked.colour} />}
            </div>
          </div>
        ))}
        {picked && picked.total === 0 && <p className="muted">Nothing in {picked.name} yet.</p>}
      </div>
    </div>
  )
}
