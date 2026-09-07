import { createTheme } from "@mui/material";

const displayFontFamily = '"Space Mono", "Courier New", monospace';
const bodyFontFamily = '"DM Sans", "Assistant", "Heebo", sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: "#202124", light: "#F4A0B7", dark: "#111214", contrastText: "#FFFFFF" },
    secondary: { main: "#E77F9B", light: "#FFD6E2", dark: "#C95E78", contrastText: "#FFFFFF" },
    text: { primary: "#202124", secondary: "#686A70" },
    background: { default: "#F8F8F6", paper: "#FFFFFF" },
    divider: "#202124",
    common: { white: "#FFFFFF", black: "#202124" },
  },
  typography: {
    fontFamily: bodyFontFamily,
    h1: { fontFamily: displayFontFamily, fontWeight: 700, letterSpacing: "-0.08em" },
    h2: { fontFamily: displayFontFamily, fontWeight: 700, letterSpacing: "-0.06em" },
    h3: { fontFamily: displayFontFamily, fontWeight: 700, letterSpacing: "-0.05em" },
    h4: { fontFamily: displayFontFamily, fontWeight: 700 },
    h5: { fontFamily: displayFontFamily, fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 3 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: "none",
          fontWeight: 600,
          minHeight: 40,
          paddingInline: 18,
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
          "&:hover": { transform: "translateY(-1px)", boxShadow: "0 8px 18px rgba(32, 33, 36, .12)" },
          "@media (prefers-reduced-motion: reduce)": { transition: "none", transform: "none" },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 600 } } },
    MuiPaper: { styleOverrides: { root: { borderRadius: 3, backgroundImage: "none" }, rounded: { borderRadius: 3 } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 3, backgroundColor: "#FFFFFF", border: "1px solid #202124", boxShadow: "6px 6px 0 rgba(32, 33, 36, .12)" } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: "rgba(248, 248, 246, 0.88)", color: "#202124", boxShadow: "none", borderBottom: "1px solid #202124", backdropFilter: "blur(14px)" } } },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 3, backgroundColor: "#FFFFFF", "& fieldset": { borderColor: "#202124" }, "&:hover fieldset": { borderColor: "#E77F9B" }, "&.Mui-focused fieldset": { borderColor: "#E77F9B", borderWidth: 2 } } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 3, border: "1px solid rgba(32, 33, 36, .2)" } } },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 999, backgroundColor: "#E77F9B" } } },
  },
});

export default theme;
