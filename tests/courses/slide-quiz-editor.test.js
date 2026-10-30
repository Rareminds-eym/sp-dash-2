import { describe, expect, it } from 'vitest'
import { isPptxResource, prepareSlideQuizzes } from '../../lib/services/slide-quiz-editor'

const question = { question: ' Question? ', options: [' One ', 'Two', 'Three', 'Four'], correct_option: 'B' }
const resource = { type: 'document', name: 'Slides', url: '/api/storage?key=slides.pptx', slideQuizzes: [{ slide_number: '4', questions: [question] }] }

describe('slide quiz editor', () => {
  it('accepts a PPTX and normalizes a slide and its questions', () => {
    expect(isPptxResource(resource)).toBe(true)
    expect(prepareSlideQuizzes(resource).quizzes[0]).toMatchObject({ slide_number: 4, questions: [{ question: 'Question?', options: ['One', 'Two', 'Three', 'Four'], correct_option: 'B' }] })
  })
  it('rejects duplicate slides and incomplete questions', () => {
    expect(prepareSlideQuizzes({ ...resource, slideQuizzes: [resource.slideQuizzes[0], resource.slideQuizzes[0]] }).error).toMatch(/unique/)
    expect(prepareSlideQuizzes({ ...resource, slideQuizzes: [{ slide_number: 4, questions: [{ ...question, options: ['', 'B', 'C', 'D'] }] }] }).error).toMatch(/four options/)
  })
  it('requires PPTX for quizzes, but permits removing them', () => {
    expect(prepareSlideQuizzes({ ...resource, url: '/file.docx' }).error).toMatch(/PPTX/)
    expect(prepareSlideQuizzes({ ...resource, url: '/file.docx', slideQuizzes: [] }).quizzes).toEqual([])
  })
})
