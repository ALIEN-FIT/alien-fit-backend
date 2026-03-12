export function addWeeks(date: Date, weeks: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + weeks * 7);
    return result;
}

export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export function differenceInCalendarDaysUTC(laterDate: Date, earlierDate: Date): number {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const normalizedLaterDate = startOfDayUTC(laterDate);
    const normalizedEarlierDate = startOfDayUTC(earlierDate);

    return Math.max(
        0,
        Math.floor((normalizedLaterDate.getTime() - normalizedEarlierDate.getTime()) / millisecondsPerDay)
    );
}

export function startOfDayUTC(date: Date): Date {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
}

export function parseISODateInput(input: string | undefined): Date {
    if (!input) {
        return new Date();
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date input');
    }
    return parsed;
}
