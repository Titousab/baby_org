export type PlaceView = {
  id: number;
  name: string;
  color: string;
  kind: 'class' | 'idea';
  auto: boolean;
  statusLine: string;
  hasError: boolean;
  watchUrl: string | null;
  changed: boolean;
};

export type ManualRow = {
  id: number;
  placeId: number;
  title: string;
  firstDate: string;
  startTime: string;
  durationMin: number;
  ageMin: number | null;
  ageMax: number | null;
  priceText: string | null;
  note: string | null;
  bookingUrl: string | null;
  repeatsWeekly: boolean;
  untilDate: string | null;
};
