# UI Component Implementation Rules

## Purpose
Guidelines for implementing UI components, especially when working with third-party libraries.

---

## Rule 1: Check Library Documentation for Unit Support

**When implementing size constraints or layout properties:**

1. **Always check if the library supports multiple unit types** (px, %, rem, em, vh, vw)
2. **Prefer the most direct unit** for your requirement:
   - Absolute requirements (e.g., "must be 750px wide") → Use pixels
   - Relative requirements (e.g., "must be 40% of container") → Use percentages
3. **Test with the simplest approach first** before adding calculations

### Example: react-resizable-panels

```typescript
// ❌ AVOID: Complex percentage calculations when you need absolute width
const minPercent = (750 / window.innerWidth) * 100;
<ResizablePanel minSize={minPercent} />

// ✅ PREFER: Direct pixel values for absolute requirements
<ResizablePanel minSize="750px" />
```

---

## Rule 2: Verify Constraints Are Working Early

**When implementing constraints (minSize, maxSize, minWidth, etc.):**

1. **Add logging immediately** to verify the constraint is being respected
2. **If the constraint is ignored**, question the unit type or prop format first
3. **Don't add complexity** (resize listeners, calculations) until you verify basic constraints work

```typescript
// Add logging to verify constraints
<ResizablePanel 
  minSize="750px"
  onResize={(size) => {
    console.log('Panel resized to:', size);
    // Verify size never goes below 750px
  }}
/>
```

---

## Rule 3: Simplicity First, Complexity Only When Needed

**When implementing dynamic behavior:**

1. **Start with the simplest solution** that could work
2. **Add complexity only when simple solutions fail**
3. **Question assumptions** if you're adding window resize listeners, complex calculations, or multiple state variables

### Anti-pattern Example
```typescript
// ❌ Over-engineered: viewport tracking, calculations, resize listeners
const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

useEffect(() => {
  const handleResize = () => setViewportWidth(window.innerWidth);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

const minPercent = useMemo(() => {
  return (750 / viewportWidth) * 100;
}, [viewportWidth]);

<ResizablePanel minSize={minPercent} />
```

### Better Approach
```typescript
// ✅ Simple: direct pixel value, no calculations needed
<ResizablePanel minSize="750px" />
```

---

## Rule 4: Read Official Documentation Before Web Search

**When working with third-party libraries:**

1. **Check the official NPM/GitHub documentation first**
2. **Look for "API Reference" or "Props" sections** that list all supported formats
3. **Check examples** in the official docs for common patterns
4. **Only search Stack Overflow** if official docs are unclear

---

## Rule 5: Test Incrementally

**When debugging why something isn't working:**

1. **Test the simplest case first** (hardcoded values)
2. **Add one layer of complexity at a time**
3. **Verify each layer works** before adding the next
4. **Roll back if a layer doesn't help**

### Example Progression
```typescript
// Step 1: Test with hardcoded pixel value
<ResizablePanel minSize="750px" />

// Step 2: If that works, make it dynamic
<ResizablePanel minSize={`${MIN_WIDTHS[view]}px`} />

// Step 3: Only add calculations if pixels don't work
// (In this case, pixels worked, so we stopped here)
```

---

## When These Rules Apply

- Implementing layout constraints (min/max sizes)
- Working with resizable components
- Integrating third-party UI libraries
- Debugging why props seem to be ignored
- Implementing responsive behavior

---

## Related Lessons

See `docs/tasks/lessons.md` for specific examples and case studies.

