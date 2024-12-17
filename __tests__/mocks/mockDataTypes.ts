// mockDataTypes.ts
export interface User {
    id: number;
    email: string;
    password: string;
  }
  
  export interface Analysis {
    idAnalysis: number;
    name: string;
    description: string;
  }
  
  export interface Diagram {
    idDiagrams: number;
    title: string;
    description: string;
  }
  
  export interface MockData {
    users: User[];
    analyses: Analysis[];
    usersHaveAnalyses: any[];
    diagrams: Diagram[];
  }
  