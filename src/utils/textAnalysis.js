const stopWords = [
  'bir', 've', 'bu', 'da', 'de', 'için', 'ile', 'çok', 'gibi', 'daha', 'en', 'kadar', 'ama', 'sonra',
  'ben', 'bana', 'beni', 'sen', 'onu', 'bunu', 'olan', 'olarak', 'var', 'yok', 'ki', 'ya',
];

function tokenizeAndFilter(allText) {
  if (!allText || !String(allText).trim()) return [];
  let text = String(allText).toLocaleLowerCase('tr-TR').replace(/[.,?!;:()'"]/g, '');
  return text.split(/\s+/).filter((w) => w.length > 2 && !stopWords.includes(w));
}

export function analyzeWordStats(allText) {
  const words = tokenizeAndFilter(allText);
  const wordCounts = {};
  words.forEach((word) => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  const sortedWords = Object.keys(wordCounts)
    .map((key) => ({ word: key, count: wordCounts[key] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const bigramCounts = {};
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
  }
  const sortedBigrams = Object.keys(bigramCounts)
    .map((key) => ({ bigram: key, count: bigramCounts[key] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { topWords: sortedWords, topBigrams: sortedBigrams };
}
