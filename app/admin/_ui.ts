/**
 * Design system — Peça Já Command Center (web SaaS).
 * Identidade verde da marca. Sem reanimated.
 */
import { StyleSheet, Platform } from 'react-native';

export type HqThemeMode = 'light' | 'dark';

const light = {
  bg: '#eef4f1',
  panel: '#ffffff',
  panel2: '#e8f1ec',
  line: '#d5e4dc',
  text: '#0f1f18',
  muted: '#5a6f64',
  faint: '#8aa094',
  green: '#00a86b',
  greenDark: '#007a4d',
  greenDim: 'rgba(0, 168, 107, 0.12)',
  amber: '#d97706',
  amberDim: 'rgba(217, 119, 6, 0.12)',
  red: '#dc2626',
  redDim: 'rgba(220, 38, 38, 0.1)',
  blue: '#2563eb',
  blueDim: 'rgba(37, 99, 235, 0.1)',
  sidebar: '#0c1f18',
  sidebarText: '#e8f5ef',
  sidebarMuted: '#8fb5a3',
  sidebarActive: 'rgba(0, 168, 107, 0.22)',
  topbar: '#ffffff',
  shadow: 'rgba(16, 36, 28, 0.1)',
  radius: 16,
  max: 1400,
};

const dark = {
  ...light,
  bg: '#0b1210',
  panel: '#121a17',
  panel2: '#18221e',
  line: '#24332c',
  text: '#eef6f1',
  muted: '#9bb0a5',
  faint: '#6d8277',
  green: '#1fd87f',
  greenDark: '#00a86b',
  greenDim: 'rgba(31, 216, 127, 0.14)',
  amber: '#ffb020',
  amberDim: 'rgba(255, 176, 32, 0.14)',
  red: '#ff6b6b',
  redDim: 'rgba(255, 107, 107, 0.14)',
  blue: '#5ba3ff',
  blueDim: 'rgba(91, 163, 255, 0.14)',
  sidebar: '#07110d',
  sidebarText: '#e8f5ef',
  sidebarMuted: '#7a9a8a',
  sidebarActive: 'rgba(31, 216, 127, 0.16)',
  topbar: '#121a17',
  shadow: 'rgba(0,0,0,0.35)',
};

let currentMode: HqThemeMode = 'light';

export function getHqMode(): HqThemeMode {
  return currentMode;
}

export function setHqMode(mode: HqThemeMode) {
  currentMode = mode;
}

export function hqTokens(mode: HqThemeMode = currentMode) {
  return mode === 'dark' ? dark : light;
}

export const hq = light;

export function makeHqStyles(mode: HqThemeMode = 'light') {
  const t = hqTokens(mode);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingBottom: 56, gap: 18 },
    h1: {
      color: t.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    h2: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.85,
      marginTop: 2,
    },
    lead: { color: t.muted, fontSize: 14, lineHeight: 21, maxWidth: 640 },
    card: {
      backgroundColor: t.panel,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.line,
      padding: 18,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: `0 8px 24px ${t.shadow}` } as any)
        : null),
    },
    cardQuiet: {
      backgroundColor: t.panel,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.line,
      padding: 16,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    errBox: {
      backgroundColor: t.redDim,
      borderColor: 'rgba(220,38,38,0.35)',
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    errText: { color: t.red, fontSize: 13, fontWeight: '600' },
    okBox: {
      backgroundColor: t.greenDim,
      borderColor: 'rgba(0,168,107,0.35)',
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    okText: { color: t.greenDark, fontSize: 13, fontWeight: '600' },
    infoBox: {
      backgroundColor: t.blueDim,
      borderColor: 'rgba(37,99,235,0.35)',
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    infoText: { color: t.blue, fontSize: 13, fontWeight: '600' },
    empty: {
      color: t.faint,
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: 28,
    },
    input: {
      backgroundColor: t.panel2,
      borderWidth: 1,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'web' ? 11 : 12,
      color: t.text,
      fontSize: 14,
    },
    btn: {
      backgroundColor: t.green,
      borderRadius: 11,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    btnText: { color: '#04140c', fontWeight: '800', fontSize: 14 },
    btnGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: t.line,
      borderRadius: 11,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
    },
    btnGhostText: { color: t.muted, fontWeight: '700', fontSize: 13 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    pillText: { fontSize: 11, fontWeight: '800' },
    kpiValue: { color: t.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
    kpiLabel: { color: t.muted, fontSize: 12, fontWeight: '600', marginTop: 6 },
    tableHead: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.line,
      paddingBottom: 10,
      marginBottom: 2,
    },
    tableHeadText: {
      color: t.faint,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.line,
      gap: 8,
    },
    tableCell: { color: t.text, fontSize: 13, fontWeight: '500' },
  });
}

export const hqStyles = makeHqStyles('light');
