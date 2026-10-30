'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const blankQuestion = () => ({ question: '', options: ['', '', '', ''], correct_option: 'A' })

export default function SlideQuizFields({ quizzes, onChange }) {
  const update = (index, changes) => onChange(quizzes.map((quiz, i) => i === index ? { ...quiz, ...changes } : quiz))
  return <section className="space-y-3 rounded-md border border-gray-200 bg-white p-3 dark:bg-gray-900 dark:border-gray-700">
    <div><h6 className="text-xs font-medium">Slide questions</h6><p className="mt-1 text-xs text-gray-500">Add multiple-choice questions for specific slides. Save the resource, lesson, and course to apply changes.</p></div>
    {quizzes.map((quiz, index) => <div key={index} className="space-y-2 rounded border p-2">
      <div className="flex items-center gap-2"><label className="text-xs" htmlFor={`slide-quiz-${index}`}>Slide number</label><Input id={`slide-quiz-${index}`} type="number" min="1" max="999999" value={quiz.slide_number} onChange={e => update(index, { slide_number: e.target.value })} className="h-8 w-24 text-xs" /><Button type="button" variant="ghost" size="sm" className="ml-auto text-xs text-red-600" onClick={() => onChange(quizzes.filter((_, i) => i !== index))}>Remove slide</Button></div>
      {quiz.questions.map((q, qi) => <div key={qi} className="space-y-2 border-t pt-2">
        <div className="flex items-center justify-between"><span className="text-xs font-medium">Question {qi + 1}</span><Button type="button" variant="ghost" size="sm" className="text-xs text-red-600" onClick={() => update(index, { questions: quiz.questions.filter((_, i) => i !== qi) })}>Remove</Button></div>
        <Input aria-label={`Question ${qi + 1}`} value={q.question} onChange={e => update(index, { questions: quiz.questions.map((item, i) => i === qi ? { ...item, question: e.target.value } : item) })} placeholder="Enter question" className="h-8 text-xs" />
        <div className="grid gap-2 sm:grid-cols-2">{q.options.map((option, oi) => <label key={oi} className="flex items-center gap-2"><span className="w-4 shrink-0 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{'ABCD'[oi]}</span><Input aria-label={`Question ${qi + 1} option ${'ABCD'[oi]}`} value={option} onChange={e => update(index, { questions: quiz.questions.map((item, i) => i === qi ? { ...item, options: item.options.map((value, j) => j === oi ? e.target.value : value) } : item) })} placeholder={`Option ${'ABCD'[oi]}`} className="h-8 text-xs" /></label>)}</div>
        <label className="flex items-center gap-2 text-xs">Correct answer <select value={q.correct_option} onChange={e => update(index, { questions: quiz.questions.map((item, i) => i === qi ? { ...item, correct_option: e.target.value } : item) })} className="rounded border bg-transparent p-1">{['A','B','C','D'].map(option => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>)}
      <Button type="button" variant="outline" size="sm" className="text-xs" disabled={quiz.questions.length >= 100} onClick={() => update(index, { questions: [...quiz.questions, blankQuestion()] })}>Add question</Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={quizzes.length >= 100} onClick={() => onChange([...quizzes, { slide_number: '', questions: [blankQuestion()] }])}>Add slide questions</Button>
  </section>
}
