// The "ask a grown-up" question: a random multiplication, both factors 6-9.

const WORDS = ['', '', '', '', '', '', 'six', 'seven', 'eight', 'nine'];

export type GateQuestion = { text: string; answer: number; choices: number[] };

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeQuestion(previous?: number): GateQuestion {
  let a = 6 + Math.floor(Math.random() * 4);
  let b = 6 + Math.floor(Math.random() * 4);
  // a different question each time
  while (previous !== undefined && a * b === previous) {
    a = 6 + Math.floor(Math.random() * 4);
    b = 6 + Math.floor(Math.random() * 4);
  }
  const answer = a * b;
  // plausible wrong products: neighbours in the 6-9 times tables and off-by-one slips
  const pool = new Set<number>();
  for (let x = 6; x <= 9; x++) {
    pool.add(a * x);
    pool.add(b * x);
    pool.add(x * x);
  }
  pool.add(answer - 1);
  pool.add(answer + 1);
  pool.add(answer - 10);
  pool.add(answer + 10);
  pool.delete(answer);
  const wrong = shuffle([...pool].filter((n) => n >= 30 && n <= 90)).slice(0, 3);
  return {
    text: `What is ${WORDS[a]} times ${WORDS[b]}?`,
    answer,
    choices: shuffle([answer, ...wrong]),
  };
}
