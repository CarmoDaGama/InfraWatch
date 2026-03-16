declare module 'net-snmp' {
  export interface Session {
    get(oids: string[], callback: (error: Error | null, varbinds: any[]) => void): void;
    close(): void;
  }

  const snmp: {
    createSession(host: string, community: string, options?: Record<string, unknown>): Session;
    Version2c: number;
    isVarbindError(varbind: any): boolean;
  };

  export default snmp;
}
