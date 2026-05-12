export async function explainQuestion(questionText: string, correctAnswer: string) {
  // AI Stub as requested
  console.log("AI Explain called (Stub Mode):", { questionText, correctAnswer });
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    explanation: "Це пояснення згенероване системою (режим заглушки). У цій версії платформи реальний ШІ тимчасово відключений для економії ресурсів. Зазвичай тут описується патофізіологія, клініка та обґрунтування вибору правильної відповіді.",
    keyword: "Ключове слово Побудова",
    mnemonic: "Заглушка: AI в цій версії вимкнено"
  };
}

export async function generateMnemonics(topic: string) {
  console.log("Generate Mnemonics called (Stub Mode):", topic);
  return {
    mnemonic: "Заглушка для мнемоніки по темі: " + topic
  };
}
