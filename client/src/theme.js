import { createTheme } from "@mui/material";

const displayFontFamily = '"Nunito", "Assistant", "Heebo", sans-serif';
const bodyFontFamily = '"Nunito", "Assistant", "Heebo", sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: "#E77F91", light: "#F4B6BE", dark: "#C95E73", contrastText: "#332632" },
    secondary: { main: "#8B739D", light: "#B7A4C5", dark: "#6E577F", contrastText: "#FFFFFF" },
    text: { primary: "#332632", secondary: "#756775" },
    background: { default: "#DCD4F1", paper: "#FFF8EF" },
    divider: "#E9C7CB",
    common: { white: "#FFF8EF", black: "#332632" },
  },
  typography: {
    fontFamily: bodyFontFamily,
    h1: { fontFamily: displayFontFamily, fontWeight: 800, letterSpacing: "-0.04em" },
    h2: { fontFamily: displayFontFamily, fontWeight: 800, letterSpacing: "-0.03em" },
    h3: { fontFamily: displayFontFamily, fontWeight: 800, letterSpacing: "-0.03em" },
    h4: { fontFamily: displayFontFamily, fontWeight: 800 },
    h5: { fontFamily: displayFontFamily, fontWeight: 800 },
    h6: { fontWeight: 800 },
    button: { fontWeight: 800 },
  },
  shape: { borderRadius: 20 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: "none",
          fontWeight: 800,
          minHeight: 44,
          paddingInline: 20,
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
          "&:hover": { transform: "translateY(-1px)", boxShadow: "0 8px 18px rgba(96, 63, 102, .14)" },
          "@media (prefers-reduced-motion: reduce)": { transition: "none", transform: "none" },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 700 } } },
    MuiPaper: { styleOverrides: { root: { borderRadius: 28, backgroundImage: "none" }, rounded: { borderRadius: 28 } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 28, backgroundColor: "#FFF8EF", border: "1px solid #E9C7CB", boxShadow: "0 16px 40px rgba(96, 63, 102, 0.12)" } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: "rgba(255, 248, 239, 0.92)", color: "#332632", boxShadow: "none", borderBottom: "1px solid #E9C7CB", backdropFilter: "blur(14px)" } } },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 18, backgroundColor: "rgba(255, 248, 239, 0.8)", "& fieldset": { borderColor: "#E9C7CB" }, "&:hover fieldset": { borderColor: "#E77F91" }, "&.Mui-focused fieldset": { borderColor: "#E77F91", borderWidth: 2 } } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 20, border: "1px solid rgba(231, 127, 145, 0.18)" } } },
    MuiTabs: { styleOverrides: { indicator: { height: 4, borderRadius: 999, backgroundColor: "#E77F91" } } },
  },
});

export default theme;
