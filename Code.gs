// ===================================================================
// Backend do Inventário de Equipamentos — Google Apps Script
// Cole este código inteiro em Extensões → Apps Script (apagando o
// conteúdo padrão "function myFunction(){}") e depois publique como
// App da Web (veja o LEIA-ME.md para o passo a passo).
// ===================================================================

// Troque por um valor único — o MESMO valor deve estar em app.js,
// na constante PLANILHA_TOKEN. Serve para impedir que outras pessoas
// gravem dados na sua planilha mesmo tendo o link.
const TOKEN = "TROQUE-ESTE-TOKEN-123";

function doGet(e) {
  try {
    const dados = lerDados();
    return respostaJson({ ok: true, equipamentos: dados.equipamentos, pessoas: dados.pessoas });
  } catch (err) {
    return respostaJson({ ok: false, erro: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) {
      return respostaJson({ ok: false, erro: "Token inválido" });
    }
    if (body.equipamentos) {
      salvarBlob("equipamentos", body.equipamentos);
      atualizarPlanilhaEquipamentos(body.equipamentos);
    }
    if (body.pessoas) {
      salvarBlob("pessoas", body.pessoas);
      atualizarPlanilhaPessoas(body.pessoas);
    }
    return respostaJson({ ok: true });
  } catch (err) {
    return respostaJson({ ok: false, erro: String(err) });
  }
}

function respostaJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---- Armazenamento (aba técnica "Dados", oculta) ----

function getPlanilhaDados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Dados");
  if (!sheet) {
    sheet = ss.insertSheet("Dados");
    sheet.getRange("A1").setValue("equipamentos_json");
    sheet.getRange("B1").setValue("[]");
    sheet.getRange("A2").setValue("pessoas_json");
    sheet.getRange("B2").setValue("[]");
    sheet.hideSheet();
  }
  return sheet;
}

function lerDados() {
  const sheet = getPlanilhaDados();
  const equipamentosRaw = sheet.getRange("B1").getValue() || "[]";
  const pessoasRaw = sheet.getRange("B2").getValue() || "[]";
  return {
    equipamentos: JSON.parse(equipamentosRaw || "[]"),
    pessoas: JSON.parse(pessoasRaw || "[]"),
  };
}

function salvarBlob(tipo, valorArray) {
  const sheet = getPlanilhaDados();
  const linha = tipo === "equipamentos" ? 1 : 2;
  sheet.getRange(linha, 2).setValue(JSON.stringify(valorArray));
}

// ---- Abas de leitura fácil (recriadas a cada gravação, só para consulta visual) ----

function resumoResponsaveis(r) {
  if (!r) return "";
  const partes = [];
  ["T1", "T2", "T3"].forEach(function (t) {
    if (r[t] && r[t].length) partes.push(t + ": " + r[t].join(", "));
  });
  if (r.Escalas && r.Escalas.length) {
    r.Escalas.forEach(function (e) {
      partes.push((e.escala || "Escala") + ": " + e.nome);
    });
  }
  return partes.join(" | ");
}

function atualizarPlanilhaEquipamentos(equipamentos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Equipamentos");
  if (!sheet) sheet = ss.insertSheet("Equipamentos");
  sheet.clear();
  sheet.appendRow(["Patrimônio", "Tipo", "Modelo", "Setor", "Status", "Responsáveis por turno", "Conferido", "Conferido por", "Atualizado em"]);
  equipamentos.forEach(function (it) {
    sheet.appendRow([
      it.patrimonio,
      it.tipo,
      it.modelo || "",
      it.setor || "",
      it.status,
      resumoResponsaveis(it.responsaveis),
      it.conferido ? "Sim" : "Não",
      it.conferidoPor || "",
      it.atualizado,
    ]);
  });
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 9);
}

function atualizarPlanilhaPessoas(pessoas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Pessoas");
  if (!sheet) sheet = ss.insertSheet("Pessoas");
  sheet.clear();
  sheet.appendRow(["Nome"]);
  pessoas.forEach(function (p) {
    sheet.appendRow([p]);
  });
  sheet.setFrozenRows(1);
}
