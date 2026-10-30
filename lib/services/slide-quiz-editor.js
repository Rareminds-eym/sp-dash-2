export function isPptxResource(resource) {
  return resource.type === 'document' && ([resource.name, resource.url, resource.r2Key].some(value => /\.pptx(?:$|[?#&])/i.test(value || '')) || /^https:\/\/docs\.google\.com\/presentation\/d\//i.test(resource.url || ''))
}

export function prepareSlideQuizzes(resource) {
  if (resource.slideQuizzes === undefined) return { quizzes: undefined }
  if (!Array.isArray(resource.slideQuizzes) || resource.slideQuizzes.length > 100) return { error: 'A presentation can have at most 100 slide quizzes.' }
  if (resource.slideQuizzes.length && !isPptxResource(resource)) return { error: 'Slide questions require a PPTX resource. Remove the questions before changing the resource type.' }
  const slides = new Set()
  const quizzes = []
  for (const quiz of resource.slideQuizzes) {
    const number = Number(quiz.slide_number)
    if (!Number.isInteger(number) || number < 1 || number > 999999 || slides.has(number)) return { error: 'Enter a unique, positive slide number for each quiz.' }
    slides.add(number)
    if (!Array.isArray(quiz.questions) || !quiz.questions.length || quiz.questions.length > 100) return { error: `Slide ${number} needs 1 to 100 questions.` }
    const questions = []
    for (const q of quiz.questions) {
      if (typeof q.question !== 'string' || !q.question.trim() || q.question.length > 2000 || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 1000) || !['A', 'B', 'C', 'D'].includes(q.correct_option)) return { error: `Complete the question and all four options for slide ${number}.` }
      questions.push({ ...q, slide_number: number, question: q.question.trim(), options: q.options.map(option => option.trim()) })
    }
    quizzes.push({ slide_number: number, questions })
  }
  return { quizzes }
}

