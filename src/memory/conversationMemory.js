// Memória VOLÁTIL da conversa recente (por telefone). O que persiste é o resumo no banco.
export function createConversationMemory({ keepMessages = 12, summarizeEvery = 5 } = {}) {
  const store = new Map();

  function entry(telefone) {
    if (!store.has(telefone)) {
      store.set(telefone, { history: [], sinceSummary: 0 });
    }
    return store.get(telefone);
  }

  return {
    add(telefone, role, content) {
      const e = entry(telefone);
      e.history.push({ role, content });
      e.sinceSummary += 1;
      if (e.history.length > keepMessages) {
        e.history.splice(0, e.history.length - keepMessages);
      }
    },

    history(telefone) {
      return entry(telefone).history;
    },

    isSummaryDue(telefone) {
      return entry(telefone).sinceSummary >= summarizeEvery;
    },

    resetSummaryCounter(telefone) {
      const e = entry(telefone);
      e.sinceSummary = 0;
    },

    clear(telefone) {
      store.delete(telefone);
    },
  };
}