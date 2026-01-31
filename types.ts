
export enum ExperimentStatus {
  PLANNING = 'PLANNING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Researcher';
}

export interface Session {
  id: string;
  experimentId: string;
  subjectId: string;
  date: string;
  durationMinutes: number;
  samplingRate: number; // e.g., 512, 1024
  channelCount: number; // e.g., 32, 64, 128
  notes: string;
  technicianName: string;
  photos?: string[]; // NEW
}

export interface Experiment {
  id: string;
  userId: string;
  title: string;
  description: string;
  startDate: string;
  status: ExperimentStatus;
  sessions: Session[];
}

export type View = 'LOGIN' | 'REGISTER' | 'DASHBOARD' | 'EXPERIMENT_DETAILS' | 'CREATE_EXPERIMENT' | 'ADD_SESSION' | 'EDIT_EXPERIMENT' | 'EDIT_SESSION' | 'MANAGE_USERS';
