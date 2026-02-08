# Integration Guide: Copying Functionality

## Method 1: Direct Component Copy

### Step 1: Identify Source
```bash
# Example: Copying a data table component from another React project
Source: https://github.com/example/admin-dashboard/components/DataTable.tsx
Target: DigitalShop-Frontend/src/components/common/DataTable.tsx
```

### Step 2: Copy and Adapt
1. **Copy the source file**
2. **Update imports** to match your project structure
3. **Adapt dependencies** (install missing packages)
4. **Modify styling** to match your design system

### Step 3: Integration Checklist
- [ ] Update import paths
- [ ] Install required dependencies  
- [ ] Adapt TypeScript types
- [ ] Update styling (Tailwind vs other CSS frameworks)
- [ ] Test functionality
- [ ] Handle any API differences

## Method 2: NPM Package Installation

```bash
# If functionality exists as a package
npm install package-name
```

Example:
```bash
npm install react-table
npm install @tanstack/react-table
```

## Method 3: Git Subtree/Submodule

```bash
# For entire repositories or folders
git subtree add --prefix=src/external-lib https://github.com/user/repo.git main --squash
```

## Method 4: API/Service Integration

```javascript
// Instead of copying code, consume as a service
const externalAPI = {
  baseURL: 'https://api.external-service.com',
  async getData(params) {
    const response = await fetch(`${this.baseURL}/data`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return response.json();
  }
};
```

## Common Integration Patterns

### React Component Integration
```typescript
// 1. Copy component structure
// 2. Adapt props interface
// 3. Update internal logic for your data model
// 4. Integrate with your state management

interface AdaptedProps {
  // Map external props to your data structure
  data: YourDataType[];
  onAction: (item: YourDataType) => void;
}

export function AdaptedComponent({ data, onAction }: AdaptedProps) {
  // Adapted component logic
}
```

### API Integration
```typescript
// 1. Create adapter layer
// 2. Map external responses to your types
// 3. Handle authentication differences

class ExternalServiceAdapter {
  async fetchData(): Promise<YourDataType[]> {
    const externalData = await externalAPI.getData();
    return this.mapToYourFormat(externalData);
  }
  
  private mapToYourFormat(external: ExternalType[]): YourDataType[] {
    return external.map(item => ({
      id: item.external_id,
      name: item.display_name,
      // ... mapping logic
    }));
  }
}
```

## Integration Considerations

### 1. **Dependencies**
- Check package.json for required packages
- Resolve version conflicts
- Install peer dependencies

### 2. **TypeScript Types**
- Adapt type definitions
- Create interface mappers
- Handle any/unknown types properly

### 3. **Styling**
- Convert CSS modules to Tailwind
- Adapt theme variables
- Ensure responsive design consistency

### 4. **State Management**
- Integrate with your Redux/Context pattern
- Adapt data flow patterns
- Handle async operations consistently

### 5. **Testing**
- Copy relevant tests
- Adapt test data
- Ensure integration tests pass

## Quick Integration Script

```bash
#!/bin/bash
# integration-helper.sh

SOURCE_FILE=$1
TARGET_DIR=$2

echo "Copying $SOURCE_FILE to $TARGET_DIR"

# 1. Copy file
cp "$SOURCE_FILE" "$TARGET_DIR/"

# 2. Update imports (basic find/replace)
sed -i 's/..\/..\/lib\//..\/lib\//g' "$TARGET_DIR/$(basename $SOURCE_FILE)"

# 3. Update styling classes
sed -i 's/styles\./tw-/g' "$TARGET_DIR/$(basename $SOURCE_FILE)"

echo "Manual steps required:"
echo "1. Check imports"
echo "2. Install dependencies"  
echo "3. Update TypeScript types"
echo "4. Test functionality"
```

## Example: Integrating External Dashboard Widget

```typescript
// Original external code
export function SalesChart({ data, theme }) {
  return (
    <div className={styles.chartContainer}>
      <Chart data={data} type="line" />
    </div>
  );
}

// Adapted for DigitalShop
export function SalesChart({ data }: { data: SalesSummary[] }) {
  // Adapt data format
  const chartData = data.map(sale => ({
    x: sale.saleDate,
    y: sale.totalAmount
  }));
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <Chart data={chartData} type="line" />
    </div>
  );
}
```