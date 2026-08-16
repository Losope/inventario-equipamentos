const { useState, useEffect, useMemo, useRef } = React;

function IconeRadioComunicador({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="15.5" y1="2" x2="15.5" y2="5.5" />
      <path d="M9 8V5.2a1.2 1.2 0 0 1 1.2-1.2h4.2a1.2 1.2 0 0 1 1.2 1.2V8" />
      <rect x="6.5" y="8" width="11" height="14" rx="1.6" />
      <rect x="9.3" y="10.6" width="5.4" height="4.2" rx="0.6" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}

function TipoIcone({ tipoKey, size = 20, color }) {
  if (tipoKey === "Rádio") return <span style={{ color: color || "#8A94A0", display: "inline-flex" }}><IconeRadioComunicador size={size} /></span>;
  const emoji = TIPOS.find((t) => t.key === tipoKey)?.emoji;
  return <span style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>;
}

const TIPOS = [
  { key: "Tablet", label: "Tablet", emoji: "📱" },
  { key: "Rádio", label: "Rádio comunicador", emoji: "📻" },
  { key: "Coletor", label: "Coletor", emoji: "📟" },
];

const STATUS = [
  { key: "Pendente", color: "#B26EF5" },
  { key: "Em uso", color: "#4C9AFF" },
  { key: "Disponível", color: "#3DD68C" },
  { key: "Manutenção", color: "#F5B700" },
  { key: "Baixado", color: "#FF5C5C" },
];

const statusColor = (s) => STATUS.find((x) => x.key === s)?.color || "#8A94A0";
const CADASTRO_SENHA = "1234"; // TODO: trocar por uma senha definitiva
const TURNO_TABS = ["T1", "T2", "T3", "Escalas"];
const ESCALAS = ["Escala A1", "Escala A2", "Escala B1", "Escala B2"];

// ==== SINCRONIZAÇÃO COM GOOGLE SHEETS ====
// Cole aqui o link do Apps Script (termina em /exec) depois de publicar, e o mesmo token definido no Code.gs
const PLANILHA_URL = "COLE_AQUI_O_LINK_DO_APPS_SCRIPT";
const PLANILHA_TOKEN = "TROQUE-ESTE-TOKEN-123";

function planilhaConfigurada() {
  return PLANILHA_URL && !PLANILHA_URL.includes("COLE_AQUI");
}

async function buscarDadosRemotos() {
  if (!planilhaConfigurada()) return null;
  try {
    const res = await fetch(PLANILHA_URL, { method: "GET" });
    const data = await res.json();
    if (data && data.ok) return { equipamentos: data.equipamentos || [], pessoas: data.pessoas || [] };
  } catch {}
  return null;
}

async function enviarDadosRemotos(payload) {
  if (!planilhaConfigurada()) return false;
  try {
    const res = await fetch(PLANILHA_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: PLANILHA_TOKEN, ...payload }),
    });
    const data = await res.json();
    return !!(data && data.ok);
  } catch {
    return false;
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function emptyResponsaveis() {
  return { T1: [], T2: [], T3: [], Escalas: [] };
}

function hasResponsavel(r) {
  if (!r) return false;
  return (r.T1 && r.T1.length) || (r.T2 && r.T2.length) || (r.T3 && r.T3.length) || (r.Escalas && r.Escalas.length);
}

function resumoResponsaveis(r) {
  if (!r) return "—";
  const partes = [];
  ["T1", "T2", "T3"].forEach((t) => {
    if (r[t] && r[t].length) partes.push(`${t}: ${r[t].join(", ")}`);
  });
  if (r.Escalas && r.Escalas.length) {
    r.Escalas.forEach((e) => partes.push(`${e.escala || "Escala"}: ${e.nome}`));
  }
  return partes.length ? partes.join(" · ") : "—";
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function InventarioEquipamentos() {
  const [items, setItems] = useState(() => loadJSON("equipamentos", []));
  const [pessoas, setPessoas] = useState(() => loadJSON("pessoas_inventario", []));
  const [saveErr, setSaveErr] = useState(false);
  const [carregando, setCarregando] = useState(planilhaConfigurada());
  const [offline, setOffline] = useState(!planilhaConfigurada());
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [pwGate, setPwGate] = useState(null); // { action: 'add'|'edit'|'delete', item? }
  const [personOpen, setPersonOpen] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [histItem, setHistItem] = useState(null);
  const [checkModal, setCheckModal] = useState(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const remoto = await buscarDadosRemotos();
      if (remoto) {
        setItems(remoto.equipamentos);
        setPessoas(remoto.pessoas);
        saveJSON("equipamentos", remoto.equipamentos);
        saveJSON("pessoas_inventario", remoto.pessoas);
        setOffline(false);
      } else if (planilhaConfigurada()) {
        setOffline(true);
      }
      setCarregando(false);
    })();
  }, []);

  const persist = (next) => {
    setItems(next);
    setSaveErr(!saveJSON("equipamentos", next));
    if (planilhaConfigurada()) {
      enviarDadosRemotos({ equipamentos: next }).then((ok) => setOffline(!ok));
    }
  };

  const persistPessoas = (next) => {
    setPessoas(next);
    saveJSON("pessoas_inventario", next);
    if (planilhaConfigurada()) {
      enviarDadosRemotos({ pessoas: next }).then((ok) => setOffline(!ok));
    }
  };

  const addPessoa = (nome) => {
    const limpo = nome.trim();
    if (!limpo) return;
    if (pessoas.some((p) => p.toLowerCase() === limpo.toLowerCase())) return;
    persistPessoas([...pessoas, limpo].sort((a, b) => a.localeCompare(b, "pt-BR")));
  };

  const importarPessoas = (nomes) => {
    const atuais = new Set(pessoas.map((p) => p.toLowerCase()));
    const novos = [];
    nomes.forEach((n) => {
      const limpo = (n || "").trim();
      if (!limpo) return;
      const chave = limpo.toLowerCase();
      if (atuais.has(chave)) return;
      atuais.add(chave);
      novos.push(limpo);
    });
    if (!novos.length) return 0;
    persistPessoas([...pessoas, ...novos].sort((a, b) => a.localeCompare(b, "pt-BR")));
    return novos.length;
  };

  const addItem = (data) => {
    const now = new Date().toISOString();
    const novo = {
      id: uid(),
      tipo: data.tipo,
      patrimonio: data.patrimonio,
      modelo: data.modelo,
      setor: data.setor,
      responsaveis: data.responsaveis,
      status: hasResponsavel(data.responsaveis) ? "Em uso" : "Disponível",
      atualizado: now,
      conferido: false,
      conferidoEm: null,
      conferidoPor: null,
      historico: [
        {
          data: now,
          evento: "Cadastro",
          responsaveis: resumoResponsaveis(data.responsaveis),
          setor: data.setor || "—",
          obs: "Item cadastrado no inventário",
        },
      ],
    };
    persist([novo, ...items]);
    setAddOpen(false);
  };

  const editEquip = (data) => {
    const now = new Date().toISOString();
    const next = items.map((it) => {
      if (it.id !== editItem.id) return it;
      return {
        ...it,
        tipo: data.tipo,
        patrimonio: data.patrimonio,
        modelo: data.modelo,
        setor: data.setor,
        responsaveis: data.responsaveis,
        status: hasResponsavel(data.responsaveis) ? (it.status === "Manutenção" || it.status === "Baixado" ? it.status : "Em uso") : "Disponível",
        atualizado: now,
        historico: [
          {
            data: now,
            evento: "Cadastro editado",
            responsaveis: resumoResponsaveis(data.responsaveis),
            setor: data.setor || "—",
            obs: "Dados do equipamento foram alterados",
          },
          ...it.historico,
        ],
      };
    });
    persist(next);
    setEditItem(null);
  };

  const deleteItem = (id) => {
    persist(items.filter((it) => it.id !== id));
  };

  const handlePwSuccess = () => {
    if (!pwGate) return;
    if (pwGate.action === "add") setAddOpen(true);
    if (pwGate.action === "edit") setEditItem(pwGate.item);
    if (pwGate.action === "delete") {
      if (window.confirm(`Excluir definitivamente o equipamento "${pwGate.item.patrimonio}"? Essa ação não pode ser desfeita.`)) {
        deleteItem(pwGate.item.id);
      }
    }
    setPwGate(null);
  };

  const moveEquip = (data) => {
    const now = new Date().toISOString();
    const next = items.map((it) => {
      if (it.id !== moveItem.id) return it;
      return {
        ...it,
        responsaveis: data.responsaveis,
        setor: data.setor,
        status: data.status,
        atualizado: now,
        historico: [
          {
            data: now,
            evento: data.status === "Disponível" ? "Devolução" : "Movimentação",
            responsaveis: resumoResponsaveis(data.responsaveis),
            setor: data.setor || "—",
            obs: data.obs || "—",
          },
          ...it.historico,
        ],
      };
    });
    persist(next);
    setMoveItem(null);
  };

  const preCadastrarPorCodigo = (codigo, tipo) => {
    const now = new Date().toISOString();
    const novo = {
      id: uid(),
      tipo,
      patrimonio: codigo,
      modelo: "",
      setor: "",
      responsaveis: emptyResponsaveis(),
      status: "Pendente",
      atualizado: now,
      conferido: false,
      conferidoEm: null,
      conferidoPor: null,
      historico: [
        {
          data: now,
          evento: "Pré-cadastro (QR/código)",
          responsaveis: "—",
          setor: "—",
          obs: "Criado automaticamente pela leitura do código. Área e responsável ainda pendentes — complete em Movimentar.",
        },
      ],
    };
    persist([novo, ...items]);
    return novo;
  };

  const confirmConferencia = (item, codigo, conferente) => {
    const now = new Date().toISOString();
    const next = items.map((it) => {
      if (it.id !== item.id) return it;
      return {
        ...it,
        conferido: true,
        conferidoEm: now,
        conferidoPor: conferente,
        historico: [
          {
            data: now,
            evento: "Conferência",
            responsaveis: resumoResponsaveis(it.responsaveis),
            setor: it.setor || "—",
            conferente,
            obs: codigo ? `Código lido: ${codigo}` : "Confirmado manualmente",
          },
          ...it.historico,
        ],
      };
    });
    persist(next);
  };

  const conferencias = useMemo(() => {
    const rows = [];
    (items || []).forEach((it) => {
      it.historico
        .filter((h) => h.evento === "Conferência" || h.evento === "Conferência por foto")
        .forEach((h) => rows.push({ patrimonio: it.patrimonio, tipo: it.tipo, dataRaw: h.data, responsaveis: h.responsaveis || "—", setor: h.setor, conferente: h.conferente || "—", obs: h.obs }));
    });
    rows.sort((a, b) => new Date(b.dataRaw) - new Date(a.dataRaw));
    return rows;
  }, [items]);

  const dashboard = useMemo(() => {
    const totalEquip = items.length;
    const conferidos = items.filter((it) => it.conferido).length;
    const porTipo = TIPOS.map((t) => {
      const doTipo = items.filter((it) => it.tipo === t.key);
      const conf = doTipo.filter((it) => it.conferido).length;
      return { tipo: t.key, total: doTipo.length, conferidos: conf };
    });
    const setoresMap = {};
    items.forEach((it) => {
      const s = it.setor?.trim() || "Sem setor";
      if (!setoresMap[s]) setoresMap[s] = { setor: s, total: 0, conferidos: 0 };
      setoresMap[s].total += 1;
      if (it.conferido) setoresMap[s].conferidos += 1;
    });
    const porSetor = Object.values(setoresMap).sort((a, b) => b.total - a.total);
    const porPessoa = {};
    conferencias.forEach((c) => {
      const nome = c.conferente || "—";
      porPessoa[nome] = (porPessoa[nome] || 0) + 1;
    });
    const ranking = Object.entries(porPessoa).sort((a, b) => b[1] - a[1]);
    const recentes = conferencias.slice(0, 8);
    return { totalEquip, conferidos, porTipo, porSetor, ranking, recentes, totalConferencias: conferencias.length };
  }, [items, conferencias]);

  const csvEscape = (v) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const exportarConferencias = () => {
    if (conferencias.length === 0) return;
    const header = ["Patrimônio", "Tipo", "Data da conferência", "Conferido por", "Responsáveis por turno", "Setor", "Observação"];
    const linhas = conferencias.map((r) => [r.patrimonio, r.tipo, fmtDate(r.dataRaw), r.conferente, r.responsaveis, r.setor, r.obs].map(csvEscape).join(";"));
    const csv = "\uFEFF" + [header.join(";"), ...linhas].join("\n");
    baixarArquivo(`conferencias-inventario-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8;");
  };

  const exportarBackup = () => {
    const payload = { equipamentos: items, pessoas, exportadoEm: new Date().toISOString() };
    baixarArquivo(`backup-inventario-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const importarBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data.equipamentos)) persist(data.equipamentos);
        if (Array.isArray(data.pessoas)) persistPessoas(data.pessoas);
      } catch {
        setSaveErr(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterTipo !== "Todos" && it.tipo !== filterTipo) return false;
      if (filterStatus !== "Todos" && it.status !== filterStatus) return false;
      const q = search.trim().toLowerCase();
      const respText = [
        ...((it.responsaveis && it.responsaveis.T1) || []),
        ...((it.responsaveis && it.responsaveis.T2) || []),
        ...((it.responsaveis && it.responsaveis.T3) || []),
        ...(((it.responsaveis && it.responsaveis.Escalas) || []).map((e) => e.nome)),
      ].join(" ").toLowerCase();
      if (q && !(it.patrimonio.toLowerCase().includes(q) || respText.includes(q) || (it.setor || "").toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [items, filterTipo, filterStatus, search]);

  const counts = useMemo(() => {
    const base = Object.fromEntries(TIPOS.map((t) => [t.key, { total: 0, "Em uso": 0, Disponível: 0, Manutenção: 0, Baixado: 0 }]));
    items.forEach((it) => {
      if (!base[it.tipo]) return;
      base[it.tipo].total += 1;
      base[it.tipo][it.status] += 1;
    });
    return base;
  }, [items]);

  return (
    <div style={{ background: "#12161A", minHeight: "100vh", color: "#E8EDF2", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .disp { font-family: 'Big Shoulders Display', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        ::selection { background: #FF7A1A; color: #12161A; }
        input:focus, select:focus, textarea:focus { outline: 2px solid #FF7A1A; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid #FF7A1A; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        @media print {
          body * { visibility: hidden; }
          #dashboard-print-area, #dashboard-print-area * { visibility: visible; }
          #dashboard-print-area { position: absolute; top: 0; left: 0; width: 100%; background: #fff !important; color: #111 !important; border: none !important; }
          #dashboard-print-area .no-print { display: none !important; }
          #dashboard-print-area th, #dashboard-print-area td { color: #111 !important; border-color: #ccc !important; }
          #dashboard-print-area .mono { color: #111 !important; }
        }
      `}</style>

      <div style={{ borderBottom: "1px solid #2E3742", background: "linear-gradient(180deg, #171D23, #12161A)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, background: "#FF7A1A" }} />
            <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: "#8A94A0", textTransform: "uppercase" }}>
              Logística · Controle de ativos
            </span>
          </div>
          <h1 className="disp" style={{ fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 800, letterSpacing: 0.5, lineHeight: 1, margin: 0, textTransform: "uppercase" }}>
            Inventário de equipamentos
          </h1>
          <p style={{ color: "#8A94A0", marginTop: 8, fontSize: 15, maxWidth: 560 }}>
            Tablets, rádios comunicadores e coletores — quantidade, responsável e histórico de movimentação em um só lugar.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 28 }}>
          {TIPOS.map(({ key, label, emoji }) => {
            const c = counts[key];
            return (
              <div key={key} style={{ background: "#1B2128", border: "1px solid #2E3742", padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="mono" style={{ fontSize: 11, color: "#8A94A0", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
                    <div className="disp" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, marginTop: 4 }}>{c.total}</div>
                  </div>
                  <span style={{ fontSize: 24, color: "#FF7A1A", display: "inline-flex" }}><TipoIcone tipoKey={key} size={24} color="#FF7A1A" /></span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  {STATUS.map((s) => (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#8A94A0" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                      {c[s.key]}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar por patrimônio, responsável ou setor"
              style={{ width: "100%", background: "#1B2128", border: "1px solid #2E3742", color: "#E8EDF2", padding: "9px 10px", fontSize: 13.5 }}
            />
          </div>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} style={selectStyle}>
            <option>Todos</option>
            {TIPOS.map((t) => <option key={t.key}>{t.key}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option>Todos</option>
            {STATUS.map((s) => <option key={s.key}>{s.key}</option>)}
          </select>
          <button onClick={() => setPwGate({ action: "add" })} style={primaryBtn}>➕ Cadastrar equipamento</button>
          <button onClick={() => setCheckModal({ item: null })} style={{ ...primaryBtn, background: "transparent", border: "1px solid #FF7A1A", color: "#FF7A1A" }}>
            📷 Ler código / QR Code
          </button>
          <button onClick={() => setPersonOpen(true)} style={{ ...primaryBtn, background: "#1B2128", color: "#E8EDF2", border: "1px solid #2E3742" }}>
            👤➕ Cadastrar pessoa
          </button>
          <button
            onClick={() => setDashboardOpen((v) => !v)}
            style={{ ...iconBtn, padding: "9px 14px", fontSize: 13.5, background: dashboardOpen ? "#FF7A1A" : "transparent", color: dashboardOpen ? "#12161A" : "#8A94A0", borderColor: dashboardOpen ? "#FF7A1A" : "#2E3742" }}
          >
            📊 Dashboard
          </button>
          <button
            onClick={exportarConferencias}
            disabled={conferencias.length === 0}
            style={{ ...iconBtn, display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 13.5, opacity: conferencias.length === 0 ? 0.5 : 1, cursor: conferencias.length === 0 ? "not-allowed" : "pointer" }}
          >
            ⬇️ Exportar conferências ({conferencias.length})
          </button>
          <button onClick={exportarBackup} style={{ ...iconBtn, padding: "9px 14px", fontSize: 13.5 }}>💾 Backup</button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...iconBtn, padding: "9px 14px", fontSize: 13.5 }}>📂 Restaurar</button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importarBackup} style={{ display: "none" }} />
        </div>

        {saveErr && (
          <div style={{ background: "#2A1B1B", border: "1px solid #FF5C5C", color: "#FF9C9C", padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>
            Não foi possível salvar no armazenamento deste navegador. Verifique o espaço disponível.
          </div>
        )}

        {carregando && (
          <div style={{ background: "#1B2128", border: "1px solid #2E3742", color: "#8A94A0", padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>
            🔄 Sincronizando com a planilha compartilhada…
          </div>
        )}

        {!carregando && planilhaConfigurada() && offline && (
          <div style={{ background: "#2A2410", border: "1px solid #F5B700", color: "#F5D97A", padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>
            ⚠️ Não foi possível sincronizar com a planilha compartilhada agora. Os dados estão sendo salvos só neste aparelho e serão enviados quando a conexão voltar.
          </div>
        )}

        {!planilhaConfigurada() && (
          <div style={{ background: "#1B2128", border: "1px dashed #2E3742", color: "#8A94A0", padding: "8px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ℹ️ Sincronização com planilha ainda não configurada — os dados estão salvos apenas neste aparelho.
          </div>
        )}

        {dashboardOpen && (
          <div id="dashboard-print-area" style={{ background: "#1B2128", border: "1px solid #2E3742", padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
              <h2 className="disp" style={{ fontSize: 20, fontWeight: 800, textTransform: "uppercase", margin: 0 }}>📊 Dashboard geral</h2>
              <button onClick={() => window.print()} className="no-print" style={{ ...iconBtn, padding: "7px 12px", fontSize: 12.5 }}>🖨️ Exportar Dashboard (PDF)</button>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "#5F6A75", marginBottom: 18 }}>Gerado em {fmtDate(new Date().toISOString())}</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 22 }}>
              <StatCard label="Equipamentos" value={dashboard.totalEquip} />
              <StatCard label="Conferidos" value={dashboard.conferidos} color="#3DD68C" />
              <StatCard label="Não conferidos" value={dashboard.totalEquip - dashboard.conferidos} color="#F5B700" />
              <StatCard label="Conferências realizadas" value={dashboard.totalConferencias} color="#4C9AFF" />
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Equipamentos x conferência — por tipo</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2E3742" }}>
                    <th style={thStyle}>Tipo</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Conferidos</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Pendentes</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>% conferido</th>
                    <th style={thStyle}>Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.porTipo.map((t) => {
                    const pct = t.total ? Math.round((t.conferidos / t.total) * 100) : 0;
                    return (
                      <tr key={t.tipo} style={{ borderBottom: "1px solid #23292F" }}>
                        <td style={tdStyle}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <TipoIcone tipoKey={t.tipo} size={15} color="#8A94A0" /> {t.tipo}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{t.total}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#3DD68C" }} className="mono">{t.conferidos}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#F5B700" }} className="mono">{t.total - t.conferidos}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{pct}%</td>
                        <td style={{ ...tdStyle, minWidth: 100 }}>
                          <div style={{ background: "#12161A", height: 6 }}>
                            <div style={{ background: "#3DD68C", height: 6, width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>Total geral</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }} className="mono">{dashboard.totalEquip}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#3DD68C" }} className="mono">{dashboard.conferidos}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#F5B700" }} className="mono">{dashboard.totalEquip - dashboard.conferidos}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }} className="mono">{dashboard.totalEquip ? Math.round((dashboard.conferidos / dashboard.totalEquip) * 100) : 0}%</td>
                    <td style={tdStyle}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Equipamentos x conferência — por setor</div>
              {dashboard.porSetor.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#5F6A75" }}>Nenhum equipamento cadastrado ainda.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #2E3742" }}>
                      <th style={thStyle}>Setor</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Conferidos</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Pendentes</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>% conferido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.porSetor.map((s) => (
                      <tr key={s.setor} style={{ borderBottom: "1px solid #23292F" }}>
                        <td style={tdStyle}>{s.setor}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{s.total}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#3DD68C" }} className="mono">{s.conferidos}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#F5B700" }} className="mono">{s.total - s.conferidos}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{s.total ? Math.round((s.conferidos / s.total) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Ranking de conferências por pessoa</div>
                {dashboard.ranking.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#5F6A75" }}>Nenhuma conferência registrada ainda.</div>
                ) : (
                  dashboard.ranking.map(([nome, qtd]) => (
                    <div key={nome} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #2E3742" }}>
                      <span>{nome}</span>
                      <span className="mono" style={{ color: "#8A94A0" }}>{qtd}</span>
                    </div>
                  ))
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Últimas conferências</div>
                {dashboard.recentes.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#5F6A75" }}>Nenhuma conferência registrada ainda.</div>
                ) : (
                  dashboard.recentes.map((c, i) => (
                    <div key={i} style={{ fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid #2E3742" }}>
                      <span className="mono">{c.patrimonio}</span> — {c.conferente} <span style={{ color: "#5F6A75" }}>({fmtDate(c.dataRaw)})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ border: "1px dashed #2E3742", padding: 40, textAlign: "center", color: "#8A94A0" }}>
            {items.length === 0 ? "Nenhum equipamento cadastrado ainda. Cadastre o primeiro item acima." : "Nenhum item corresponde aos filtros aplicados."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((it) => {
              return (
                <div key={it.id} style={{ background: "#1B2128", border: "1px solid #2E3742", borderLeft: `3px solid ${statusColor(it.status)}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <span style={{ flexShrink: 0 }}><TipoIcone tipoKey={it.tipo} size={20} color="#8A94A0" /></span>
                  <div style={{ minWidth: 130 }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{it.patrimonio}</div>
                    <div style={{ fontSize: 12, color: "#8A94A0" }}>{it.tipo}{it.modelo ? ` · ${it.modelo}` : ""}</div>
                  </div>
                  <div style={{ flex: "1 1 220px" }}>
                    <div style={{ fontSize: 12, color: "#8A94A0" }}>Responsáveis por turno</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{resumoResponsaveis(it.responsaveis)}</div>
                  </div>
                  <div style={{ flex: "1 1 110px" }}>
                    <div style={{ fontSize: 12, color: "#8A94A0" }}>Setor</div>
                    <div style={{ fontSize: 13.5 }}>{it.setor || "—"}</div>
                  </div>
                  <div style={{ minWidth: 100 }}>
                    <span style={{ fontSize: 11.5, padding: "3px 9px", border: `1px solid ${statusColor(it.status)}`, color: statusColor(it.status), textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {it.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#5F6A75", minWidth: 120 }}>{fmtDate(it.atualizado)}</div>
                  <div style={{ minWidth: 130 }}>
                    {it.conferido ? (
                      <span title={`Conferido por ${it.conferidoPor || "—"} em ${fmtDate(it.conferidoEm)}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#3DD68C" }}>
                        ✅ Conferido{it.conferidoPor ? ` (${it.conferidoPor})` : ""}
                      </span>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#5F6A75" }}>⚠️ Não conferido</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <button onClick={() => setCheckModal({ item: it })} title="Conferir por código de barras ou QR Code" style={iconBtn}>📷</button>
                    <button onClick={() => setHistItem(it)} title="Histórico" style={iconBtn}>🕐</button>
                    <button onClick={() => setMoveItem(it)} title="Movimentar" style={iconBtn}>🔁</button>
                    <button onClick={() => setPwGate({ action: "edit", item: it })} title="Editar cadastro" style={iconBtn}>✏️</button>
                    <button onClick={() => setPwGate({ action: "delete", item: it })} title="Excluir equipamento" style={{ ...iconBtn, color: "#FF9C9C", borderColor: "#5C2E2E" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pwGate && <PasswordModal onClose={() => setPwGate(null)} onSuccess={handlePwSuccess} />}
      {addOpen && <AddModal pessoas={pessoas} onClose={() => setAddOpen(false)} onSave={addItem} />}
      {editItem && <EditModal item={editItem} pessoas={pessoas} onClose={() => setEditItem(null)} onSave={editEquip} />}
      {moveItem && <MoveModal item={moveItem} pessoas={pessoas} onClose={() => setMoveItem(null)} onSave={moveEquip} />}
      {histItem && <HistModal item={histItem} onClose={() => setHistItem(null)} />}
      {personOpen && <PersonModal pessoas={pessoas} onClose={() => setPersonOpen(false)} onSave={addPessoa} onImport={importarPessoas} />}
      {checkModal && (
        <BarcodeModal target={checkModal.item} items={items} pessoas={pessoas} onAddPessoa={addPessoa} onPreCadastro={preCadastrarPorCodigo} onClose={() => setCheckModal(null)} onConfirm={confirmConferencia} />
      )}
    </div>
  );
}

const selectStyle = { background: "#1B2128", border: "1px solid #2E3742", color: "#E8EDF2", padding: "9px 10px", fontSize: 13.5 };
const primaryBtn = { display: "flex", alignItems: "center", gap: 6, background: "#FF7A1A", color: "#12161A", border: "none", padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const iconBtn = { background: "transparent", border: "1px solid #2E3742", color: "#8A94A0", padding: 7, cursor: "pointer", display: "flex" };
const overlay = { position: "fixed", inset: 0, background: "rgba(10,12,15,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal = { background: "#1B2128", border: "1px solid #2E3742", width: "100%", maxWidth: 440, padding: 24, maxHeight: "88vh", overflowY: "auto" };
const label = { fontSize: 12, color: "#8A94A0", marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };
const field = { width: "100%", background: "#12161A", border: "1px solid #2E3742", color: "#E8EDF2", padding: "9px 10px", fontSize: 14, marginBottom: 14 };
const thStyle = { textAlign: "left", padding: "6px 8px", fontSize: 11, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.5 };
const tdStyle = { padding: "7px 8px" };

function StatCard({ label: lbl, value, color }) {
  return (
    <div style={{ background: "#12161A", border: "1px solid #2E3742", padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.5 }}>{lbl}</div>
      <div className="disp" style={{ fontSize: 28, fontWeight: 800, color: color || "#E8EDF2" }}>{value}</div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
      <h2 className="disp" style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase", margin: 0 }}>{title}</h2>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A94A0", cursor: "pointer", fontSize: 18 }}>✖️</button>
    </div>
  );
}

function ResponsaveisPorTurno({ value, onChange, pessoas }) {
  const [activeTab, setActiveTab] = useState("T1");
  const [inputNome, setInputNome] = useState("");
  const [escalaSel, setEscalaSel] = useState("Escala A1");
  const datalistId = "lista-pessoas-turno";

  const preenchido = {
    T1: value.T1.length > 0,
    T2: value.T2.length > 0,
    T3: value.T3.length > 0,
    Escalas: value.Escalas.length > 0,
  };

  const addNomeSimples = () => {
    const nome = inputNome.trim();
    if (!nome) return;
    onChange({ ...value, [activeTab]: [...value[activeTab], nome] });
    setInputNome("");
  };

  const removeNomeSimples = (tab, idx) => {
    onChange({ ...value, [tab]: value[tab].filter((_, i) => i !== idx) });
  };

  const addEscala = () => {
    const nome = inputNome.trim();
    if (!nome) return;
    onChange({ ...value, Escalas: [...value.Escalas, { escala: escalaSel, nome }] });
    setInputNome("");
  };

  const removeEscala = (idx) => {
    onChange({ ...value, Escalas: value.Escalas.filter((_, i) => i !== idx) });
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={label}>Responsáveis por turno</label>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {TURNO_TABS.map((tab) => (
          <button key={tab} type="button" onClick={() => { setActiveTab(tab); setInputNome(""); }}
            style={{ flex: 1, padding: "7px 4px", fontSize: 12.5, fontWeight: 600,
              background: activeTab === tab ? "#FF7A1A" : "#12161A",
              color: activeTab === tab ? "#12161A" : preenchido[tab] ? "#3DD68C" : "#8A94A0",
              border: "1px solid #2E3742", cursor: "pointer" }}>
            {tab}{preenchido[tab] ? ` (${tab === "Escalas" ? value.Escalas.length : value[tab].length})` : ""}
          </button>
        ))}
      </div>

      {activeTab === "Escalas" ? (
        <>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {ESCALAS.map((esc) => (
              <button key={esc} type="button" onClick={() => setEscalaSel(esc)}
                style={{ padding: "6px 10px", fontSize: 12,
                  background: escalaSel === esc ? "#FF7A1A" : "#1B2128",
                  color: escalaSel === esc ? "#12161A" : "#8A94A0",
                  border: "1px solid #2E3742", cursor: "pointer" }}>
                {esc}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input style={{ ...field, marginBottom: 0, flex: 1 }} list={datalistId} value={inputNome} onChange={(e) => setInputNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEscala()} placeholder={`Nome (${escalaSel})`} />
            <button type="button" onClick={addEscala} style={{ ...primaryBtn, padding: "9px 14px" }}>+</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            {value.Escalas.map((e, i) => (
              <span key={i} style={{ fontSize: 12, padding: "4px 8px", background: "#12161A", border: "1px solid #2E3742", color: "#B8C0C9", display: "flex", alignItems: "center", gap: 6 }}>
                {e.escala}: {e.nome}
                <button type="button" onClick={() => removeEscala(i)} style={{ background: "none", border: "none", color: "#8A94A0", cursor: "pointer", padding: 0, fontSize: 11 }}>✖️</button>
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input style={{ ...field, marginBottom: 0, flex: 1 }} list={datalistId} value={inputNome} onChange={(e) => setInputNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNomeSimples()} placeholder={`Nome do turno ${activeTab}`} />
            <button type="button" onClick={addNomeSimples} style={{ ...primaryBtn, padding: "9px 14px" }}>+</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            {value[activeTab].map((nome, i) => (
              <span key={i} style={{ fontSize: 12, padding: "4px 8px", background: "#12161A", border: "1px solid #2E3742", color: "#B8C0C9", display: "flex", alignItems: "center", gap: 6 }}>
                {nome}
                <button type="button" onClick={() => removeNomeSimples(activeTab, i)} style={{ background: "none", border: "none", color: "#8A94A0", cursor: "pointer", padding: 0, fontSize: 11 }}>✖️</button>
              </span>
            ))}
          </div>
        </>
      )}
      <datalist id={datalistId}>
        {(pessoas || []).map((p) => <option key={p} value={p} />)}
      </datalist>
      <div className="mono" style={{ fontSize: 11, color: "#5F6A75", marginTop: 4 }}>{resumoResponsaveis(value)}</div>
    </div>
  );
}

function PasswordModal({ onClose, onSuccess }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const confirmar = () => (senha === CADASTRO_SENHA ? onSuccess() : setErro("Senha incorreta."));

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Senha necessária" onClose={onClose} />
        <p style={{ fontSize: 13, color: "#8A94A0", marginTop: 0, marginBottom: 14 }}>Digite a senha para alterar o cadastro de equipamentos.</p>
        <input type="password" autoFocus style={field} value={senha}
          onChange={(e) => { setSenha(e.target.value); setErro(""); }}
          onKeyDown={(e) => e.key === "Enter" && confirmar()} placeholder="Senha" />
        {erro && <div style={{ color: "#FF9C9C", fontSize: 13, marginTop: -8, marginBottom: 14 }}>{erro}</div>}
        <button onClick={confirmar} style={{ ...primaryBtn, width: "100%", justifyContent: "center" }}>Confirmar</button>
      </div>
    </div>
  );
}

function PersonModal({ pessoas, onClose, onSave, onImport }) {
  const [nome, setNome] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef(null);
  const salvar = () => { if (!nome.trim()) return; onSave(nome); setNome(""); };

  const importarTexto = () => {
    const nomes = importText.split(/[\n,;]+/).map((n) => n.trim()).filter(Boolean);
    if (!nomes.length) return;
    const qtd = onImport(nomes) || 0;
    setImportText("");
    setImportMsg(qtd > 0 ? `✅ ${qtd} pessoa(s) importada(s).` : "Nenhum nome novo — todos já estavam cadastrados.");
  };

  const importarArquivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const nomes = String(reader.result)
        .split(/\r?\n/)
        .map((linha) => linha.split(",")[0].trim())
        .filter(Boolean);
      const qtd = onImport(nomes) || 0;
      setImportMsg(qtd > 0 ? `✅ ${qtd} pessoa(s) importada(s) do arquivo.` : "Nenhum nome novo encontrado no arquivo.");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Cadastrar pessoa" onClose={onClose} />
        <p style={{ fontSize: 13, color: "#8A94A0", marginTop: 0, marginBottom: 14 }}>
          Pessoas cadastradas aparecem como sugestão ao preencher responsáveis e conferências — mas sempre dá pra digitar um nome novo também.
        </p>
        <label style={label}>Nome</label>
        <input style={field} autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()} placeholder="Nome da pessoa" />
        <button disabled={!nome.trim()} onClick={salvar}
          style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginBottom: 18, opacity: nome.trim() ? 1 : 0.5, cursor: nome.trim() ? "pointer" : "not-allowed" }}>
          Adicionar
        </button>

        <label style={label}>Importar lista de colaboradores</label>
        <textarea style={{ ...field, minHeight: 70, resize: "vertical", fontSize: 13 }} value={importText} onChange={(e) => setImportText(e.target.value)}
          placeholder={"Cole uma lista de nomes, um por linha (ou separados por vírgula)\nEx:\nJoão Silva\nMaria Souza"} />
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button disabled={!importText.trim()} onClick={importarTexto}
            style={{ ...primaryBtn, flex: 1, justifyContent: "center", opacity: importText.trim() ? 1 : 0.5, cursor: importText.trim() ? "pointer" : "not-allowed" }}>
            Importar lista colada
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ ...iconBtn, padding: "9px 12px" }}>📂 Arquivo</button>
          <input ref={fileRef} type="file" accept=".txt,.csv" onChange={importarArquivo} style={{ display: "none" }} />
        </div>
        {importMsg && <div style={{ fontSize: 12.5, color: "#3DD68C", marginBottom: 14 }}>{importMsg}</div>}

        <label style={label}>Já cadastradas ({pessoas.length})</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pessoas.length === 0 ? (
            <span style={{ fontSize: 12.5, color: "#5F6A75" }}>Nenhuma pessoa cadastrada ainda.</span>
          ) : (
            pessoas.map((p) => (
              <span key={p} style={{ fontSize: 12, padding: "4px 9px", background: "#12161A", border: "1px solid #2E3742", color: "#B8C0C9" }}>{p}</span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AddModal({ onClose, onSave, pessoas }) {
  const [tipo, setTipo] = useState("Tablet");
  const [patrimonio, setPatrimonio] = useState("");
  const [modelo, setModelo] = useState("");
  const [setor, setSetor] = useState("");
  const [responsaveis, setResponsaveis] = useState(emptyResponsaveis());

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Cadastrar equipamento" onClose={onClose} />
        <label style={label}>Tipo</label>
        <select style={field} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => <option key={t.key}>{t.key}</option>)}
        </select>
        <label style={label}>Patrimônio / identificação *</label>
        <input style={field} value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} placeholder="Ex: TB-0042" />
        <label style={label}>Modelo</label>
        <input style={field} value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex: Samsung Tab Active 4" />
        <label style={label}>Setor</label>
        <input style={field} value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: Expedição" />
        <ResponsaveisPorTurno value={responsaveis} onChange={setResponsaveis} pessoas={pessoas} />
        <button disabled={!patrimonio.trim()}
          onClick={() => onSave({ tipo, patrimonio: patrimonio.trim(), modelo: modelo.trim(), setor: setor.trim(), responsaveis })}
          style={{ ...primaryBtn, width: "100%", justifyContent: "center", opacity: patrimonio.trim() ? 1 : 0.5, cursor: patrimonio.trim() ? "pointer" : "not-allowed" }}>
          Salvar equipamento
        </button>
      </div>
    </div>
  );
}

function EditModal({ item, onClose, onSave, pessoas }) {
  const [tipo, setTipo] = useState(item.tipo);
  const [patrimonio, setPatrimonio] = useState(item.patrimonio);
  const [modelo, setModelo] = useState(item.modelo || "");
  const [setor, setSetor] = useState(item.setor || "");
  const [responsaveis, setResponsaveis] = useState(item.responsaveis || emptyResponsaveis());

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Editar equipamento" onClose={onClose} />
        <label style={label}>Tipo</label>
        <select style={field} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => <option key={t.key}>{t.key}</option>)}
        </select>
        <label style={label}>Patrimônio / identificação *</label>
        <input style={field} value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} />
        <label style={label}>Modelo</label>
        <input style={field} value={modelo} onChange={(e) => setModelo(e.target.value)} />
        <label style={label}>Setor</label>
        <input style={field} value={setor} onChange={(e) => setSetor(e.target.value)} />
        <ResponsaveisPorTurno value={responsaveis} onChange={setResponsaveis} pessoas={pessoas} />
        <button disabled={!patrimonio.trim()}
          onClick={() => onSave({ tipo, patrimonio: patrimonio.trim(), modelo: modelo.trim(), setor: setor.trim(), responsaveis })}
          style={{ ...primaryBtn, width: "100%", justifyContent: "center", opacity: patrimonio.trim() ? 1 : 0.5, cursor: patrimonio.trim() ? "pointer" : "not-allowed" }}>
          Salvar alterações
        </button>
      </div>
    </div>
  );
}

function MoveModal({ item, onClose, onSave, pessoas }) {
  const [setor, setSetor] = useState(item.setor || "");
  const [status, setStatus] = useState(item.status);
  const [responsaveis, setResponsaveis] = useState(item.responsaveis || emptyResponsaveis());
  const [obs, setObs] = useState("");

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Movimentar equipamento" onClose={onClose} />
        <div className="mono" style={{ fontSize: 13, color: "#8A94A0", marginBottom: 14 }}>{item.patrimonio} · {item.tipo}</div>
        <label style={label}>Setor</label>
        <input style={field} value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: Recebimento" />
        <ResponsaveisPorTurno value={responsaveis} onChange={setResponsaveis} pessoas={pessoas} />
        <label style={label}>Status</label>
        <select style={field} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS.map((s) => <option key={s.key}>{s.key}</option>)}
        </select>
        <label style={label}>Observação</label>
        <textarea style={{ ...field, minHeight: 60, resize: "vertical" }} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: transferido para cobrir turno noturno" />
        <button onClick={() => onSave({ responsaveis, setor: setor.trim(), status, obs: obs.trim() })} style={{ ...primaryBtn, width: "100%", justifyContent: "center" }}>
          Confirmar movimentação
        </button>
      </div>
    </div>
  );
}

function BarcodeModal({ target, items, pessoas, onAddPessoa, onPreCadastro, onClose, onConfirm }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [selectedId, setSelectedId] = useState(target ? target.id : "");
  const [conferente, setConferente] = useState("");
  const [novaPessoa, setNovaPessoa] = useState(false);
  const [confirmado, setConfirmado] = useState(null); // { patrimonio, conferente, preCadastro }
  const [tipoNovo, setTipoNovo] = useState("Tablet");
  const [zoomCap, setZoomCap] = useState(null); // { min, max, step }
  const [zoomAtual, setZoomAtual] = useState(null);
  const scannerRef = useRef(null);
  const regionId = "leitor-codigo-barras";

  const decodedRef = useRef(false);

  const limparRegiao = () => {
    const el = document.getElementById(regionId);
    if (el) el.innerHTML = "";
  };

  const pararStreamInterno = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    limparRegiao();
  };

  useEffect(() => {
    return () => {
      pararStreamInterno();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarCodigo = (codigo) => {
    setResult({ codigo });
    if (target) {
      setSelectedId(target.id);
    } else {
      const found = items.find((it) => {
        const a = it.patrimonio.toLowerCase();
        const b = codigo.toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      });
      if (found) setSelectedId(found.id);
    }
  };

  const aguardarElemento = () =>
    new Promise((resolve) => {
      let tentativas = 0;
      const checar = () => {
        tentativas += 1;
        if (document.getElementById(regionId) || tentativas > 60) resolve();
        else requestAnimationFrame(checar);
      };
      checar();
    });

  const iniciarScanner = async () => {
    setError("");
    setResult(null);
    setManual(false);
    setConfirmado(null);
    setScanning(true);
    decodedRef.current = false;
    await aguardarElemento();
    const elemento = document.getElementById(regionId);
    if (!elemento) {
      setScanning(false);
      setError("Não foi possível preparar a câmera. Toque em Iniciar leitura novamente.");
      return;
    }

    const config = {
      fps: 12,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const tamanho = Math.floor(minEdge * 0.8);
        return { width: tamanho, height: tamanho };
      },
      disableFlip: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    };

    const tentarIniciar = async (cameraConfig) => {
      const html5Qr = new Html5Qrcode(regionId);
      scannerRef.current = html5Qr;
      await html5Qr.start(
        cameraConfig,
        config,
        async (decodedText) => {
          if (decodedRef.current) return;
          decodedRef.current = true;
          try {
            await pararStreamInterno();
          } catch {}
          setScanning(false);
          setZoomCap(null);
          setZoomAtual(null);
          aplicarCodigo(decodedText);
        },
        () => {}
      );
      try {
        const caps = html5Qr.getRunningTrackCapabilities();
        if (caps && caps.zoom && caps.zoom.max > caps.zoom.min) {
          const step = caps.zoom.step || 0.1;
          setZoomCap({ min: caps.zoom.min, max: caps.zoom.max, step });
          const inicial = Math.min(caps.zoom.max, caps.zoom.min + (caps.zoom.max - caps.zoom.min) * 0.3);
          setZoomAtual(inicial);
          html5Qr.applyVideoConstraints({ advanced: [{ zoom: inicial }] }).catch(() => {});
        } else {
          setZoomCap(null);
          setZoomAtual(null);
        }
      } catch {
        setZoomCap(null);
        setZoomAtual(null);
      }
    };

    try {
      await tentarIniciar({ facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } });
    } catch (e1) {
      try {
        await tentarIniciar({ facingMode: "environment" });
      } catch (e1b) {
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length) {
            const traseira = cameras.find((c) => /back|traseira|rear|environment/i.test(c.label || "")) || cameras[cameras.length - 1];
            await tentarIniciar(traseira.id);
          } else {
            throw e1b;
          }
        } catch (e2) {
          setScanning(false);
          const nome = (e2 && e2.name) || (e1b && e1b.name) || (e1 && e1.name) || "";
          if (nome === "NotAllowedError") {
            setError("Permissão da câmera negada. Nas configurações do navegador (ou do site), permita o acesso à câmera e tente de novo.");
          } else if (nome === "NotFoundError") {
            setError("Nenhuma câmera foi encontrada neste aparelho.");
          } else if (nome === "NotReadableError") {
            setError("A câmera parece estar em uso por outro aplicativo. Feche outros apps que usem a câmera e tente de novo.");
          } else {
            setError("Não foi possível acessar a câmera. Se você abriu pelo ícone instalado na tela inicial, tente abrir o mesmo link direto pelo navegador (Safari/Chrome) e permitir o acesso à câmera. Você também pode usar a leitura manual.");
          }
        }
      }
    }
  };

  const ajustarZoom = (v) => {
    setZoomAtual(v);
    if (scannerRef.current) {
      scannerRef.current.applyVideoConstraints({ advanced: [{ zoom: v }] }).catch(() => {});
    }
  };



  const pararScanner = async () => {
    await pararStreamInterno();
    setScanning(false);
    setZoomCap(null);
    setZoomAtual(null);
  };

  const lerProximo = () => {
    setResult(null);
    setSelectedId(target ? target.id : "");
    setConferente("");
    setNovaPessoa(false);
    setConfirmado(null);
    setError("");
    iniciarScanner();
  };

  const selectedItem = items.find((it) => it.id === selectedId);
  const codigoMismatch = selectedItem && result?.codigo && !selectedItem.patrimonio.toLowerCase().includes(result.codigo.toLowerCase()) && !result.codigo.toLowerCase().includes(selectedItem.patrimonio.toLowerCase());

  const confirmar = () => {
    if (!selectedItem || !conferente.trim()) return;
    if (novaPessoa && conferente.trim()) onAddPessoa(conferente.trim());
    onConfirm(selectedItem, result.codigo, conferente.trim());
    if (target) {
      onClose();
    } else {
      setConfirmado({ patrimonio: selectedItem.patrimonio, conferente: conferente.trim() });
      setResult(null);
    }
  };

  const preCadastrar = () => {
    if (!result?.codigo) return;
    const novo = onPreCadastro(result.codigo, tipoNovo);
    setConfirmado({ patrimonio: novo.patrimonio, preCadastro: true });
    setResult(null);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Conferir por código de barras / QR Code" onClose={onClose} />
        {target && <div className="mono" style={{ fontSize: 13, color: "#8A94A0", marginBottom: 14 }}>{target.patrimonio} · {target.tipo}</div>}

        {confirmado && (
          <div style={{ marginBottom: 4 }}>
            {confirmado.preCadastro ? (
              <div style={{ background: "#241A2E", border: "1px solid #B26EF5", color: "#D8AFFA", padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>
                🆕 <span className="mono">{confirmado.patrimonio}</span> pré-cadastrado como <strong>Pendente</strong>. Área e responsável ficam pendentes — complete depois em "Movimentar".
              </div>
            ) : (
              <div style={{ background: "#12241A", border: "1px solid #3DD68C", color: "#3DD68C", padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>
                ✅ <span className="mono">{confirmado.patrimonio}</span> conferido por {confirmado.conferente}.
              </div>
            )}
            <button onClick={lerProximo} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginBottom: 8 }}>📷 Ler próximo equipamento</button>
            <button onClick={onClose} style={{ ...iconBtn, width: "100%", justifyContent: "center", fontSize: 12.5 }}>Encerrar conferência</button>
          </div>
        )}

        {!confirmado && !result && !manual && (
          <>
            <div id={regionId} style={{ width: "100%", height: scanning ? 260 : 0, overflow: "hidden", background: "#000", marginBottom: scanning ? 12 : 0 }}></div>
            {scanning && zoomCap && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#8A94A0", marginBottom: 4 }}>
                  <span>🔍 Aproximar (zoom)</span>
                </div>
                <input
                  type="range"
                  min={zoomCap.min}
                  max={zoomCap.max}
                  step={zoomCap.step}
                  value={zoomAtual ?? zoomCap.min}
                  onChange={(e) => ajustarZoom(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            )}
            {scanning && (
              <div style={{ fontSize: 12, color: "#8A94A0", marginBottom: 10 }}>
                Aproxime bem a câmera do código de barras até preencher o quadro{zoomCap ? " (ou use o zoom acima)" : ""}, e segure firme por um instante — códigos pequenos podem levar alguns segundos para focar.
              </div>
            )}
            {!scanning ? (
              <button onClick={iniciarScanner} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginBottom: 8 }}>📷 Iniciar leitura</button>
            ) : (
              <button onClick={pararScanner} style={{ ...iconBtn, width: "100%", justifyContent: "center", marginBottom: 8 }}>Parar câmera</button>
            )}
            <button onClick={() => setManual(true)} style={{ ...iconBtn, width: "100%", justifyContent: "center", marginBottom: 14, fontSize: 12.5 }}>
              Digitar código manualmente
            </button>
          </>
        )}

        {!confirmado && manual && !result && (
          <>
            <label style={label}>Código do patrimônio</label>
            <input style={field} autoFocus value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Ex: TB-0042" />
            <button disabled={!manualCode.trim()} onClick={() => aplicarCodigo(manualCode.trim())}
              style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginBottom: 8, opacity: manualCode.trim() ? 1 : 0.5 }}>
              Usar este código
            </button>
            <button onClick={() => setManual(false)} style={{ ...iconBtn, width: "100%", justifyContent: "center", marginBottom: 14, fontSize: 12.5 }}>
              Voltar para leitura por câmera
            </button>
          </>
        )}

        {error && <div style={{ color: "#FF9C9C", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {!confirmado && result && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: "#8A94A0", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Código lido</div>
            <div className="mono" style={{ fontSize: 16, marginBottom: 12 }}>{result.codigo}</div>

            {!target && !selectedItem && (
              <div style={{ background: "#1F1B2E", border: "1px solid #B26EF5", padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#D8AFFA", marginBottom: 10 }}>
                  Esse código não está em nenhum equipamento cadastrado. Você pode pré-cadastrar automaticamente — só escolha o tipo, e o resto (área, responsável) fica pendente pra completar depois.
                </div>
                <label style={label}>Tipo do equipamento</label>
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {TIPOS.map((t) => (
                    <button key={t.key} type="button" onClick={() => setTipoNovo(t.key)}
                      style={{ flex: 1, padding: "8px 4px", fontSize: 12.5, fontWeight: 600,
                        background: tipoNovo === t.key ? "#B26EF5" : "#12161A",
                        color: tipoNovo === t.key ? "#1F1B2E" : "#8A94A0",
                        border: "1px solid #2E3742", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <TipoIcone tipoKey={t.key} size={14} color={tipoNovo === t.key ? "#1F1B2E" : "#8A94A0"} /> {t.key}
                    </button>
                  ))}
                </div>
                <button onClick={preCadastrar} style={{ ...primaryBtn, width: "100%", justifyContent: "center", background: "#B26EF5", color: "#1F1B2E" }}>
                  🆕 Pré-cadastrar como novo equipamento
                </button>
              </div>
            )}

            <label style={label}>{!target && !selectedItem ? "Ou selecione um item já cadastrado" : "Confirmar equipamento"}</label>
            <select style={field} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Selecione o item do inventário</option>
              {items.map((it) => <option key={it.id} value={it.id}>{it.patrimonio} · {it.tipo}</option>)}
            </select>

            {codigoMismatch && (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, color: "#F5B700", marginBottom: 10 }}>
                ⚠️ O código lido não bate exatamente com o patrimônio cadastrado. Confira antes de confirmar.
              </div>
            )}

            <label style={label}>Conferido por *</label>
            {!novaPessoa ? (
              <select style={field} value={pessoas.includes(conferente) ? conferente : ""}
                onChange={(e) => {
                  if (e.target.value === "__nova__") { setNovaPessoa(true); setConferente(""); }
                  else setConferente(e.target.value);
                }}>
                <option value="">Selecione quem está conferindo</option>
                {pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="__nova__">+ Nova pessoa</option>
              </select>
            ) : (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <input style={{ ...field, marginBottom: 0, flex: 1 }} autoFocus value={conferente} onChange={(e) => setConferente(e.target.value)} placeholder="Nome da pessoa" />
                <button type="button" onClick={() => { setNovaPessoa(false); setConferente(""); }} style={{ ...iconBtn, flexShrink: 0 }}>✖️</button>
              </div>
            )}

            <button
              disabled={!selectedItem || !conferente.trim()}
              onClick={confirmar}
              style={{ ...primaryBtn, width: "100%", justifyContent: "center", opacity: selectedItem && conferente.trim() ? 1 : 0.5, cursor: selectedItem && conferente.trim() ? "pointer" : "not-allowed" }}>
              ✅ Marcar como conferido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HistModal({ item, onClose }) {
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Histórico" onClose={onClose} />
        <div className="mono" style={{ fontSize: 13, color: "#8A94A0", marginBottom: 16 }}>{item.patrimonio} · {item.tipo}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {item.historico.map((h, i) => (
            <div key={i} style={{ borderLeft: "2px solid #2E3742", paddingLeft: 14, paddingBottom: 18, position: "relative" }}>
              <div style={{ position: "absolute", left: -5, top: 2, width: 8, height: 8, borderRadius: "50%", background: "#FF7A1A" }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>{h.evento}</div>
              <div className="mono" style={{ fontSize: 11.5, color: "#5F6A75", margin: "2px 0" }}>{fmtDate(h.data)}</div>
              <div style={{ fontSize: 13, color: "#B8C0C9" }}>Responsáveis: {h.responsaveis || "—"} · Setor: {h.setor}{h.conferente ? ` · Conferido por: ${h.conferente}` : ""}</div>
              {h.obs && h.obs !== "—" && <div style={{ fontSize: 12.5, color: "#8A94A0", marginTop: 2 }}>{h.obs}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<InventarioEquipamentos />);
