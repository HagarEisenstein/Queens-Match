import { createTheme } from "@mui/material";

const displayFontFamily = '"Sunday", "Fredoka", "Nunito", sans-serif';
const bodyFontFamily = '"Assistant", "Heebo", sans-serif';

const theme = createTheme({
  palette: {
    primary: {
      main: "#FF7D9C",
      light: "#FFB4C6",
      dark: "#E86A88",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#715CF3",
      light: "#9588F5",
      dark: "#5A48D9",
      contrastText: "#FFFFFF",
    },
    text: {
      primary: "#2E2E2E",
      secondary: "#69727D",
    },
    background: {
      default: "#FFF0F6",
      paper: "#FFFFFF",
    },
    divider: "#FFD9E7",
    common: {
      white: "#FFFFFF",
      black: "#2E2E2E",
    },
  },
  typography: {
    fontFamily: bodyFontFamily,
    h1: {
      fontFamily: displayFontFamily,
      fontWeight: 600,
    },
    h2: {
      fontFamily: displayFontFamily,
      fontWeight: 600,
    },
    h3: {
      fontFamily: displayFontFamily,
      fontWeight: 600,
    },
    h4: {
      fontFamily: displayFontFamily,
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: "none",
          fontWeight: 600,
          transition:
            "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
        rounded: {
          borderRadius: 16,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          color: "#2E2E2E",
          boxShadow: "none",
          borderBottom: "1px solid #FFD9E7",
        },
      },
    },
  },
});

export default theme;
