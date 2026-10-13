// Starter list only. Add more words your team wants to block.
const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt', 'slut', 'nigg',
  'puta', 'putang', 'tangina', 'gago', 'gaga', 'bobo', 'tanga', 'ulol', 'pakyu',
  'kantot', 'burat', 'titi', 'pepe', 'hindot', 'lintik',
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

function isBadNickname(nickname) {
  const cleaned = nickname
    .toLowerCase()
    .replace(/[013457@$]/g, (ch) => LEET[ch])
    .replace(/[^a-z]/g, '');
  return BLOCKED_WORDS.some((word) => cleaned.includes(word));
}

module.exports = { isBadNickname };
