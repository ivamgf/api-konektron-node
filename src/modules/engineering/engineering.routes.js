import { Router } from 'express';
import { authenticate } from '#middlewares/authenticate.js';
import { requireSection } from '#middlewares/authorize.js';
import {
  canAccessSection,
  IMPLEMENTED_SECTIONS,
  SECTION_PROJECT_TYPE,
  SECTIONS,
} from '#config/plans.js';

// RF6 - catálogo de seções. O front usa /sections para montar o menu.
const router = Router();
router.use(authenticate);

router.get('/sections', (req, res) => {
  res.json(
    Object.values(SECTIONS).map((key) => {
      const implemented = IMPLEMENTED_SECTIONS.includes(key);
      return {
        key,
        enabled: canAccessSection(req.user, key),
        implemented,
        projectType: SECTION_PROJECT_TYPE[key] ?? null,
        route: implemented ? `/api/v1/projects/:projectId/${key}` : null,
      };
    }),
  );
});

// Seções ainda não implementadas respondem 501
for (const section of Object.values(SECTIONS)) {
  if (IMPLEMENTED_SECTIONS.includes(section)) continue;
  router.use(`/${section}`, requireSection(section), (_req, res) =>
    res.status(501).json({ error: `Seção "${section}" ainda não implementada` }),
  );
}

export default router;
