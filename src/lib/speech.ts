/** "Hear it": browser speech synthesis with a Russian voice, if the device has one. */
export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function russianVoice(): SpeechSynthesisVoice | undefined {
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ru'));
}

export function hasRussianVoice(): Promise<boolean> {
  if (!speechAvailable()) return Promise.resolve(false);
  if (speechSynthesis.getVoices().length) return Promise.resolve(!!russianVoice());
  return new Promise((resolve) => {
    const done = () => resolve(!!russianVoice());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

export function speak(text: string): void {
  if (!speechAvailable()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  const v = russianVoice();
  if (v) u.voice = v;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}
