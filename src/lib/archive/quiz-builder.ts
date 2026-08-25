export interface ChoiceState {
  choices: string[];
  correctIndex: number;
  correctIndices: number[];
}

export function removeChoiceAt(
  question: ChoiceState,
  removedIndex: number,
): ChoiceState {
  if (
    question.choices.length <= 2 ||
    removedIndex < 0 ||
    removedIndex >= question.choices.length
  ) {
    return question;
  }

  const choices = question.choices.filter((_, index) => index !== removedIndex);
  const correctIndex =
    question.correctIndex > removedIndex
      ? question.correctIndex - 1
      : question.correctIndex === removedIndex
        ? Math.min(removedIndex, choices.length - 1)
        : question.correctIndex;
  const correctIndices = question.correctIndices
    .filter((index) => index !== removedIndex)
    .map((index) => (index > removedIndex ? index - 1 : index));

  return { choices, correctIndex, correctIndices };
}

export function validCoversForLessons(
  covers: string[],
  lessonSlugs: string[],
): string[] {
  const validLessonSlugs = new Set(lessonSlugs);
  return covers.filter((slug) => validLessonSlugs.has(slug));
}
