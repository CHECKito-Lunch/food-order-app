// lib/dayjs.ts
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Plugin global aktivieren
dayjs.extend(weekOfYear);
dayjs.extend(utc);
dayjs.extend(timezone);

export default dayjs;