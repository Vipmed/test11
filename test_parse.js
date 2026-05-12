const text = `
1. Який колір неба?
+Синій
-Червоний
-Зелений

2. Скільки буде 2+2?
-3
+4
-5
`;

let cleanText = text.replace(/\r/g, '');
let blocks = [];

const numPattern = /(?:^|\n)(?=\s*(?:Задача|Питання|Test|Вопрос|№)?\s*\d+[\.\)]\s*)/i;
const sections = cleanText.split(numPattern);
blocks = sections.filter(b => b.trim().length > 10);

console.log("Blocks:", blocks.length);
blocks.forEach((b, i) => {
    console.log(`-- Block ${i} --\n${b.trim()}`);
});
