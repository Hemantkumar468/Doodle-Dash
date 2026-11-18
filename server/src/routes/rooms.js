import { Router } from 'express';

export function roomsRouter(manager) {
  const router = Router();
  router.get('/public', (_request, response) => response.json({ rooms: manager.listPublic() }));
  return router;
}
