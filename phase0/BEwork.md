# Phase 0 Backend Work Guide — Feature/Foundation-BE

Is guide ka maqsad aapko step-by-step batana hai ki **Phase 0** mein backend par kya aur kaise kaam karna hai. Hum isme authentication ke baad user ko uske workspace se connect karenge.

---

## 🏗️ Step 1: Controller Setup
Sabse pehle humein logic ko route se alag karke ek proper controller mein dalna hai.

### File: `backend/src/controllers/user.controller.ts`
**Kaam:** Nayi file banayein aur usme `getMe` handler implement karein.

**Implementation Boilerplate:**
```typescript
import { Request, Response, NextFunction } from 'express';
import * as workspaceService from '../services/workspace.service';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized access');
    }

    // 1. Find user's workspace
    let workspace = await workspaceService.getUserWorkspace(user.id);

    // 2. Auto-create if missing
    if (!workspace) {
      workspace = await workspaceService.createWorkspace({
        name: `${user.name || 'My'}'s Workspace`,
        owner_id: user.id
      });
    }

    // 3. Get member role
    const members = await workspaceService.getWorkspaceMembers(workspace.id);
    const currentMember = members.find(m => m.user_id === user.id);

    // 4. Send Unified Response
    return res.status(200).json(
      new ApiResponse(200, {
        ...user,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          role: currentMember?.role || 'owner'
        }
      }, 'User profile retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};
```

---

## 🛣️ Step 2: Routing Update
Purane inline handler ko hatakar naye controller se connect karna.

### File: `backend/src/routes/user.routes.ts`
**Kaam:** Routes ko rewire karna.

**Implementation Details:**
1.  `import * as userController from "../controllers/user.controller";` add karein.
2.  Route ko update karein:
    ```typescript
    router.get("/me", protect, userController.getMe);
    ```

---

## 🛠️ Step 3: Best Practices & Pro Tips

| Feature | Pro Tip |
| :--- | :--- |
| **Error Handling** | Hamesha `next(error)` use karein taaki global error middleware (jo `src/middlewares/error.middleware.ts` mein ho sakta hai) trigger ho sake. |
| **Type Safety** | Requests ke liye `(req as any)` avoid karne ke liye `src/types/express/index.d.ts` mein `Request` interface ko extend karna ek achha modular approach hai. |
| **Naming** | Auto-create karte waqt `user.name` agar null hai toh fallback `"My Workspace"` zaroor dein taaki UI khali na lage. |

---

## ✅ Final Task Checklist

Aapko ye items ek-ek karke tick karne hain:

- [x] **File Created:** `backend/src/controllers/user.controller.ts` exist karti hai.
- [x] **Logic Implemented:** `getMe` function mein workspace check aur auto-create logic likha hai.
- [x] **Try/Catch added:** Error handling setup hai taaki app crash na ho.
- [x] **ApiResponse Used:** Standard response format follow kiya hai.
- [x] **Routes Cleaned:** `user.routes.ts` se inline logic hatt gayi hai.
- [x] **Role checking:** Response mein `role` field present hai.
- [x] **Verified:** API test karke dekha (Postman/ThunderClient) aur wo sahi data de rahi hai.
- [x] **TypeScript Verify:** `npx tsc --noEmit` run kiya aur zero errors hain.

---

**Final Status:** Phase 0 Backend 100% Complete according to the plan.
