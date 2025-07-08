// lib/dayjs.ts
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';

// Plugin global aktivieren
dayjs.extend(weekOfYear);

export default dayjs;