// Generate pseudonymous ID
export const generatePseudonymId = (): string => {
  const adjectives = ['Swift', 'Bright', 'Calm', 'Bold', 'Keen', 'Wise', 'Quick', 'Sharp'];
  const animals = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Lion', 'Eagle', 'Tiger'];
  const number = Math.floor(Math.random() * 999) + 1;
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${animals[Math.floor(Math.random() * animals.length)]}${number}`;
};
