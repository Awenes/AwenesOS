/// <reference types="vite/client" />
import type { DesktopApi } from "../contracts";
declare global { interface Window { awenes: DesktopApi; } }
export {};
