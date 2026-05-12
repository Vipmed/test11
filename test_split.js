const fs = require('fs');

function testParsing(text) {
    const cleanText = text.replace(/\r/g, '');
    let blocks = cleanText.split(/\n\s*\n/).filter(b => b.trim().length > 10);
    const numPatternMatch = /(?:^|\n)(?=\s*(?:Задача|Питання|Test|Вопрос|№)?\s*\d+[\.\)]\s*)/i;
    const splitByNum = cleanText.split(numPatternMatch).filter(b => b.trim().length > 10);
    
    if (splitByNum.length > 2 && splitByNum.length > blocks.length) {
        blocks = splitByNum;
    }

    console.log(`Found ${blocks.length} blocks.`);
    if (blocks.length > 0) {
        console.log("First block:", JSON.stringify(blocks[0].substring(0, 100)));
    }
}

testParsing(`
1. Хто є хто?
+А
-Б
-В

2. Де є де?
-Х
+У
-Й
`);

testParsing(`
Питання 1. Хто є хто?
+А
-Б
-В
Питання 2. Де є де?
-Х
+У
-Й
`);

testParsing(`
Щось 1
+А
-Б

Щось 2
+В
-Г
`);
