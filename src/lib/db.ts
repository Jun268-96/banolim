import type { Member, Category, ActivityLog } from '../types';

// Mock initial data
let members: Member[] = [
    { id: '1', name: '김선생', score: 150, isApproved: true },
    { id: '2', name: '이수석', score: 320, isApproved: true },
    { id: '3', name: '박신입', score: 40, isApproved: false },
];

let categories: Category[] = [
    { id: 'c1', categoryName: '정기모임 출석', pointValue: 10 },
    { id: 'c2', categoryName: '과제 제출', pointValue: 20 },
    { id: 'c3', categoryName: '연수 발표', pointValue: 50 },
    { id: 'c4', categoryName: '지각', pointValue: -5 },
];

const logs: ActivityLog[] = [
    { id: 'l1', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), memberId: '1', categoryId: 'c1', pointDelta: 10 },
    { id: 'l2', timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), memberId: '2', categoryId: 'c3', pointDelta: 50 },
];

// Read operations
export const getMembers = async (): Promise<Member[]> => {
    return [...members].sort((a, b) => b.score - a.score);
};

export const getCategories = async (): Promise<Category[]> => {
    return [...categories];
};

export const getLogs = async (): Promise<ActivityLog[]> => {
    return [...logs];
};

// Write operations (simulating GAS endpoints)
export const addMember = async (name: string): Promise<Member> => {
    const newMember: Member = {
        id: Math.random().toString(36).substring(7),
        name,
        score: 0,
        isApproved: false,
    };
    members.push(newMember);
    return newMember;
};

export const deleteMember = async (id: string): Promise<void> => {
    members = members.filter(m => m.id !== id);
};

export const addCategory = async (categoryName: string, pointValue: number): Promise<Category> => {
    const newCat: Category = {
        id: Math.random().toString(36).substring(7),
        categoryName,
        pointValue
    };
    categories.push(newCat);
    return newCat;
};

export const deleteCategory = async (id: string): Promise<void> => {
    categories = categories.filter(c => c.id !== id);
};

export const awardPoints = async (memberId: string, categoryId: string): Promise<void> => {
    const category = categories.find(c => c.id === categoryId);
    const memberIndex = members.findIndex(m => m.id === memberId);

    if (category && memberIndex !== -1) {
        members[memberIndex].score += category.pointValue;
        logs.push({
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            memberId,
            categoryId,
            pointDelta: category.pointValue
        });
    }
};
