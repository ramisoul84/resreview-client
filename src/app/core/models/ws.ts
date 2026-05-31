export type WsOp =
  | { op: 'set_version_image'; verId: string; dataUrl: string }
  | { op: 'create_pin'; pin: any }
  | { op: 'update_pin'; pin: any }
  | { op: 'create_annotation'; annotation: any }
  | { op: 'update_annotation'; annotation: any }
  | { op: 'delete_annotation'; annotationId: string }
  | { op: 'set_viewing_version'; versionId: string };

export interface OnlineUser {
  userId: string;
  name: string;
  color: string;
  versionId: string;
}

export interface WsMessage {
  type: 'patch' | 'presence' | 'error';
  op?: WsOp;
  online?: number;
  users?: OnlineUser[];
  error?: string;
}
