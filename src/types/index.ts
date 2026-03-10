export interface Member {
    id: string;
    name: string;
    score: number;
    isApproved: boolean;
}

export interface Category {
    id: string;
    categoryName: string;
    pointValue: number;
}

export interface ActivityLog {
    id: string;
    timestamp: string;
    memberId: string;
    categoryId: string;
    pointDelta: number;
}
