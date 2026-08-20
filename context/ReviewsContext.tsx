import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BusinessReview } from '@/types';
import { getAllBusinesses } from '@/data/businesses';
import { getSimulatedCityLabel } from '@/utils/demoLocation';

interface ReviewsContextType {
  reviews: BusinessReview[];
  isLoading: boolean;
  getReviewsForBusiness: (businessId: string) => BusinessReview[];
  getAverageForBusiness: (businessId: string) => { average: number; count: number };
  getAverageForDriver: (driverId: string) => { average: number; count: number };
  hasReviewedOrder: (orderId: string) => boolean;
  addReview: (input: {
    businessId: string;
    orderId: string;
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    driverRating: number;
    driverId?: string;
    driverName?: string;
    driverComment?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);
const REVIEWS_KEY = '@pecaja_reviews';
const SEED_FLAG_KEY = '@pecaja_reviews_seeded_v1';

function sampleComments(): string[] {
  const city = getSimulatedCityLabel();
  return [
    'Pedido chegou quentinho e no prazo. Recomendo!',
    'Comida boa e embalagem ok. Voltarei a pedir.',
    'Atendimento rápido pelo app. Sabor excelente.',
    `Preço justo para ${city}. Tudo certo.`,
    'Entrega pontual. O prato estava bem temperado.',
    'Gostei bastante. Só faltou um molho extra.',
    'Melhor opção da região. Pedido completo.',
    'Muito bom! Vale a pena assinar o Peça Já aqui.',
  ];
}

const SAMPLE_NAMES = [
  'Ana Souza',
  'Carlos Lima',
  'Fernanda Dias',
  'João Pedro',
  'Mariana Costa',
  'Pedro Alves',
  'Luciana Rocha',
  'Rafael Nunes',
];

function seedReviews(): BusinessReview[] {
  const now = Date.now();
  const seeded: BusinessReview[] = [];
  const comments = sampleComments();

  getAllBusinesses().forEach((biz, bizIndex) => {
    const count = 2 + (bizIndex % 3);
    for (let i = 0; i < count; i++) {
      const idx = (bizIndex * 3 + i) % comments.length;
      const stars = 4 + ((bizIndex + i) % 2);
      seeded.push({
        id: `seed-${biz.id}-${i}`,
        businessId: biz.id,
        orderId: `SEED-${biz.id}-${i}`,
        userId: `seed-user-${idx}`,
        userName: SAMPLE_NAMES[idx % SAMPLE_NAMES.length],
        rating: stars,
        comment: comments[idx],
        createdAt: new Date(now - (bizIndex * 7 + i * 13) * 3600_000).toISOString(),
        driverRating: stars,
      });
    }
  });

  return seeded;
}

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [reviews, setReviews] = useState<BusinessReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stored, seededFlag] = await Promise.all([
          AsyncStorage.getItem(REVIEWS_KEY),
          AsyncStorage.getItem(SEED_FLAG_KEY),
        ]);

        let list: BusinessReview[] = stored ? JSON.parse(stored) : [];

        if (!seededFlag) {
          const seeds = seedReviews();
          const existingIds = new Set(list.map((r) => r.id));
          const toAdd = seeds.filter((s) => !existingIds.has(s.id));
          list = [...list, ...toAdd];
          await AsyncStorage.setItem(SEED_FLAG_KEY, '1');
          await AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(list));
        }

        setReviews(list);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews)).catch(() => {});
    }
  }, [reviews, isLoading]);

  const getReviewsForBusiness = useCallback(
    (businessId: string) =>
      reviews
        .filter((r) => r.businessId === businessId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews]
  );

  const getAverageForBusiness = useCallback(
    (businessId: string) => {
      const list = reviews.filter((r) => r.businessId === businessId);
      if (!list.length) return { average: 0, count: 0 };
      const sum = list.reduce((acc, r) => acc + r.rating, 0);
      return { average: Math.round((sum / list.length) * 10) / 10, count: list.length };
    },
    [reviews]
  );

  const getAverageForDriver = useCallback(
    (driverId: string) => {
      const list = reviews.filter(
        (r) => r.driverId === driverId && typeof r.driverRating === 'number'
      );
      if (!list.length) return { average: 0, count: 0 };
      const sum = list.reduce((acc, r) => acc + (r.driverRating ?? 0), 0);
      return { average: Math.round((sum / list.length) * 10) / 10, count: list.length };
    },
    [reviews]
  );

  const hasReviewedOrder = useCallback(
    (orderId: string) => reviews.some((r) => r.orderId === orderId),
    [reviews]
  );

  const addReview = useCallback(
    async (input: {
      businessId: string;
      orderId: string;
      userId: string;
      userName: string;
      rating: number;
      comment: string;
      driverRating: number;
      driverId?: string;
      driverName?: string;
      driverComment?: string;
    }) => {
      if (input.rating < 1 || input.rating > 5) {
        return { success: false, error: 'Avalie o estabelecimento de 1 a 5 estrelas.' };
      }
      if (input.driverRating < 1 || input.driverRating > 5) {
        return { success: false, error: 'Avalie o entregador de 1 a 5 estrelas.' };
      }
      const comment = input.comment.trim();
      if (comment.length < 5) {
        return { success: false, error: 'Escreva um comentário com pelo menos 5 caracteres.' };
      }
      if (reviews.some((r) => r.orderId === input.orderId)) {
        return { success: false, error: 'Este pedido já foi avaliado.' };
      }

      const review: BusinessReview = {
        id: `rev-${Date.now()}`,
        businessId: input.businessId,
        orderId: input.orderId,
        userId: input.userId,
        userName: input.userName,
        rating: input.rating,
        comment,
        createdAt: new Date().toISOString(),
        driverRating: input.driverRating,
        driverId: input.driverId,
        driverName: input.driverName,
        driverComment: input.driverComment?.trim() || undefined,
      };

      setReviews((prev) => [review, ...prev]);
      return { success: true };
    },
    [reviews]
  );

  const value = useMemo(
    () => ({
      reviews,
      isLoading,
      getReviewsForBusiness,
      getAverageForBusiness,
      getAverageForDriver,
      hasReviewedOrder,
      addReview,
    }),
    [
      reviews,
      isLoading,
      getReviewsForBusiness,
      getAverageForBusiness,
      getAverageForDriver,
      hasReviewedOrder,
      addReview,
    ]
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews() {
  const context = useContext(ReviewsContext);
  if (!context) throw new Error('useReviews deve ser usado dentro de ReviewsProvider');
  return context;
}
