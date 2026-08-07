import type { ReactNode } from "react";
export const metadata = { title:"SEVEN Cloud Core", description:"Private MCP + browser bridge + Vault" };
export default function Layout({children}:{children:ReactNode}) { return <html lang="pt-BR"><body style={{margin:0,background:"#050505",color:"#f5f5f5",fontFamily:"system-ui"}}>{children}</body></html>; }
