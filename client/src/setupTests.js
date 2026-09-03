import { TextEncoder, TextDecoder } from "util";

// jsdom (via react-scripts' Jest 27 environment) doesn't provide these globals,
// but react-router-dom v7 requires them at import time.
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;

import "@testing-library/jest-dom";
