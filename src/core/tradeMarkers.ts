export type TradeMarkerType =
  | 'entry_long'
  | 'entry_short'
  | 'exit_long'
  | 'exit_short'
  | 'stop_loss'
  | 'take_profit'
  | 'signal'
  | 'alert';

export type TradeMarker = {
  type: TradeMarkerType;
  time: number;
  price: number;
  label?: string;
  size?: number;
  metadata?: {
    tradeId?: string;
    profit?: number;
    quantity?: number;
    strategy?: string;
  };
};

export type TradeMarkerStyle = {
  shape: 'triangle_up' | 'triangle_down' | 'circle' | 'cross' | 'diamond' | 'warning';
  color: string;
  borderColor?: string;
  size: number;
};

export const DEFAULT_MARKER_STYLES: Record<TradeMarkerType, TradeMarkerStyle> = {
  entry_long: { shape: 'triangle_up', color: '#4CAF50', size: 10 },
  entry_short: { shape: 'triangle_down', color: '#F44336', size: 10 },
  exit_long: { shape: 'triangle_up', color: '#81C784', borderColor: '#4CAF50', size: 8 },
  exit_short: { shape: 'triangle_down', color: '#E57373', borderColor: '#F44336', size: 8 },
  stop_loss: { shape: 'cross', color: '#F44336', size: 10 },
  take_profit: { shape: 'circle', color: '#4CAF50', size: 8 },
  signal: { shape: 'diamond', color: '#FFC107', size: 8 },
  alert: { shape: 'warning', color: '#FF9800', size: 10 },
};
