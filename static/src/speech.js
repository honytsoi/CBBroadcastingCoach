/* speech.js */
export class Speech {
    constructor() {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            this.synth = window.speechSynthesis;
        } else {
            this.synth = null;
        }
    }

    speak(text, voiceType, language = "en-US", voicePreference = null) {
        if (!this.synth) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        if (voicePreference) {
            const voices = this.synth.getVoices();
            const selectedVoice = voices.find(voice => voice.name === voicePreference);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        }
        this.synth.speak(utterance);
    }
}