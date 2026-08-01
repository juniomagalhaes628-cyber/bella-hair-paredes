#!/usr/bin/env bash
#
# Verificador de consistência — Bella Hair Paredes
# ------------------------------------------------
# O site tem 5 páginas HTML independentes que repetem os mesmos dados
# (telefone, morada, CSP, links legais, ícones). Mudar um deles obriga a
# editar 5 ficheiros — e é fácil esquecer um.
#
# Este script avisa quando as páginas divergem.
#
#   Uso:  bash scripts/verificar-paginas.sh
#   Sai com código 1 se encontrar divergências (útil em CI).

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

PAGINAS=(index.html marcacoes.html privacidade.html obrigado.html 404.html)
ERROS=0

vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
verde()    { printf '\033[32m%s\033[0m\n' "$1"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$1"; }

# ── 1. Valores que têm de ser IGUAIS em todas as páginas ──────────────────
# Formato: "nome_legível|padrão grep"
IGUAIS=(
  "Telefone|913 533 917"
  "CSP|Content-Security-Policy"
  "Referrer-Policy|name=\"referrer\""
  "apple-touch-icon|apple-touch-icon"
  "Manifest|rel=\"manifest\""
  "theme-color|theme-color"
  "Favicon|rel=\"icon\""
)

echo "── Elementos obrigatórios em todas as páginas ──"
for entrada in "${IGUAIS[@]}"; do
  nome="${entrada%%|*}"; padrao="${entrada#*|}"
  faltam=()
  for p in "${PAGINAS[@]}"; do
    grep -qF -- "$padrao" "$p" || faltam+=("$p")
  done
  if [ ${#faltam[@]} -eq 0 ]; then
    verde "  ✓ $nome"
  else
    vermelho "  ✗ $nome — em falta: ${faltam[*]}"
    ERROS=$((ERROS+1))
  fi
done

# ── 2. A CSP tem de ser byte-a-byte idêntica ──────────────────────────────
echo
echo "── CSP idêntica entre páginas ──"
ref_csp=$(grep -o 'content="default-src[^"]*"' index.html | head -1)
divergem=()
for p in "${PAGINAS[@]}"; do
  csp=$(grep -o 'content="default-src[^"]*"' "$p" | head -1)
  [ "$csp" = "$ref_csp" ] || divergem+=("$p")
done
if [ ${#divergem[@]} -eq 0 ]; then
  verde "  ✓ as 5 páginas têm a mesma política"
else
  vermelho "  ✗ CSP diferente de index.html em: ${divergem[*]}"
  ERROS=$((ERROS+1))
fi

# ── 3. Dados de contacto e legais (só onde existe rodapé completo) ────────
echo
echo "── Dados de contacto e legais ──"
COM_RODAPE=(index.html marcacoes.html privacidade.html)
LEGAIS=(
  "Morada|R. Dr. José Barbosa Leão 44"
  "Livro de Reclamações|livroreclamacoes.pt"
)
for entrada in "${LEGAIS[@]}"; do
  nome="${entrada%%|*}"; padrao="${entrada#*|}"
  faltam=()
  for p in "${COM_RODAPE[@]}"; do
    grep -qF -- "$padrao" "$p" || faltam+=("$p")
  done
  if [ ${#faltam[@]} -eq 0 ]; then
    verde "  ✓ $nome"
  else
    vermelho "  ✗ $nome — em falta: ${faltam[*]}"
    ERROS=$((ERROS+1))
  fi
done

# ── 4. Ficheiros referenciados que têm de existir ─────────────────────────
echo
echo "── Ficheiros referenciados ──"
for f in assets/og-image.jpg assets/apple-touch-icon.png assets/icon-192.png \
         assets/icon-512.png manifest.json styles.css; do
  if [ -f "$f" ]; then verde "  ✓ $f"
  else vermelho "  ✗ $f não existe"; ERROS=$((ERROS+1)); fi
done

# ── 5. Avisos: coisas por completar (não são erros) ───────────────────────
echo
echo "── Por completar ──"
if grep -q 'formsubmit.co/[a-zA-Z0-9._%+-]*@' index.html marcacoes.html 2>/dev/null; then
  amarelo "  ! Email em texto no HTML — usar alias do FormSubmit para evitar spam"
fi
if grep -q "INSTAGRAM_FEED_URL = ''" index.html 2>/dev/null; then
  amarelo "  ! Feed do Instagram inativo — falta o URL do Behold"
fi
if grep -q 'NIF do prestador' privacidade.html 2>/dev/null; then
  amarelo "  ! NIF por preencher (obrigatório — DL 7/2004)"
fi
if [ -f assets/hero-1.mp4 ]; then
  kb=$(du -k assets/hero-1.mp4 | cut -f1)
  [ "$kb" -gt 3000 ] && amarelo "  ! hero-1.mp4 tem $((kb/1024)) MB — comprimir para ~2 MB"
fi

# ── Resultado ─────────────────────────────────────────────────────────────
echo
if [ "$ERROS" -eq 0 ]; then
  verde "✓ Sem divergências entre as páginas."
  exit 0
else
  vermelho "✗ $ERROS divergência(s) encontrada(s)."
  exit 1
fi
