// Canopy AI chat card (#54), top of the right column. Static mock for the
// demo: replies are canned (see replies.ts) and nothing leaves the device.
// A real LLM is a later opt-in, with names/emails stripped before sending.

import './ai-chat.css';
import { escapeHtml } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { cannedReply } from './replies';

const TYPING_DELAY_MS = 700;

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const first = name.trim().split(/\s+/)[0];
  return `Good ${part}${first ? `, ${first}` : ''}. Need help planning your week or matching a journal entry to your KSBs?`;
}

export function mountAiChat(card: HTMLElement, apprenticeName = '') {
  card.classList.add('ai-chat');
  card.innerHTML = `
    <div class="ai-head">
      <span class="ai-badge">${icon('sparkles', 16)}</span>
      <div class="ai-heading">
        <div class="ai-title">Canopy AI</div>
        <div class="ai-subtitle">Your learning assistant</div>
      </div>
      <span class="ai-status" title="Demo mode — canned replies, nothing leaves your device" aria-label="Demo mode"></span>
    </div>
    <div class="ai-messages" data-ref="messages" role="log" aria-live="polite"></div>
    <form class="ai-form" data-ref="form">
      <input class="ai-input" data-ref="input" placeholder="Ask Canopy anything…" maxlength="300" aria-label="Message Canopy AI" autocomplete="off" />
      <button class="ai-send" type="submit" title="Send" aria-label="Send">${icon('send', 16)}</button>
    </form>
    <p class="ai-note">Preview: canned replies only. Real AI is coming as an opt-in, with names and emails stripped first.</p>`;

  const messages = card.querySelector<HTMLElement>('[data-ref="messages"]')!;
  const form = card.querySelector<HTMLFormElement>('[data-ref="form"]')!;
  const input = card.querySelector<HTMLInputElement>('[data-ref="input"]')!;

  const addMessage = (from: 'ai' | 'user', text: string) => {
    const bubble = document.createElement('div');
    bubble.className = `ai-msg ai-msg--${from}`;
    bubble.innerHTML = escapeHtml(text);
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  };

  addMessage('ai', greeting(apprenticeName));

  let pending = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || pending) return;
    input.value = '';
    addMessage('user', text);

    pending = true;
    const typing = addMessage('ai', '');
    typing.classList.add('is-typing');
    typing.setAttribute('aria-label', 'Canopy is typing');
    typing.innerHTML = '<span></span><span></span><span></span>';
    setTimeout(() => {
      typing.remove();
      addMessage('ai', cannedReply(text));
      pending = false;
    }, TYPING_DELAY_MS);
  });
}
