import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemApi, rolesApi } from '../lib/api';
import { cn } from '@/lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import { useSettings } from '../contexts/SettingsContext';
import {
  Settings,
  Building2,
  Receipt,
  Bell,
  Database,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HardDrive,
  Shield,
  Info,
  Plus,
  Pencil,
  X,
  Users,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface SystemSettings {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  currencyCode: string;
  currencySymbol: string;
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  taxEnabled: boolean;
  taxName: string;
  taxNumber: string;
  defaultTaxRate: number;
  taxInclusive: boolean;
  receiptHeaderText: string;
  receiptFooterText: string;
  receiptShowTaxBreakdown: boolean;
  receiptAutoPrint: boolean;
  receiptPaperWidth: number;
  lowStockAlertsEnabled: boolean;
  lowStockThreshold: number;
}

interface DatabaseStats {
  databaseSize: string;
  masterData: { name: string; count: number }[];
  transactionalData: { name: string; count: number }[];
  totalRecords: number;
}

interface ResetPreview {
  willBeCleared: { name: string; count: number }[];
  willBePreserved: { name: string; count: number }[];
}

// ============================================================================
// SETTINGS PAGE COMPONENT
// ============================================================================

export function SettingsPage() {
  const perms = usePermissions();
  const [activeTab, setActiveTab] = useState<'system' | 'data' | 'roles'>(
    perms.canEditSettings ? 'system' : perms.canManageRoles ? 'roles' : 'data'
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          Settings
        </h1>
        <p className="text-gray-500 mt-1">
          Manage system configuration, roles, and data
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {perms.canEditSettings && (
          <button
            onClick={() => setActiveTab('system')}
            className={cn(
              'py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors',
              activeTab === 'system'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <Settings className="h-4 w-4" />
            System Settings
          </button>
          )}
          {perms.canManageRoles && (
          <button
            onClick={() => setActiveTab('roles')}
            className={cn(
              'py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors',
              activeTab === 'roles'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <Shield className="h-4 w-4" />
            Role Management
          </button>
          )}
          {perms.canResetSystem && (
          <button
            onClick={() => setActiveTab('data')}
            className={cn(
              'py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors',
              activeTab === 'data'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <Database className="h-4 w-4" />
            Data Management
          </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'system' && perms.canEditSettings && <SystemSettingsTab />}
      {activeTab === 'roles' && perms.canManageRoles && <RoleManagementTab />}
      {activeTab === 'data' && perms.canResetSystem && <DataManagementTab />}
    </div>
  );
}

// ============================================================================
// ROLE MANAGEMENT TAB (Cloned from SamplePOS pattern)
// ============================================================================

interface Permission {
  key: string;
  module: string;
  action: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  isActive: boolean;
  permissionCount: number;
  permissions?: string[];
}

function RoleManagementTab() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set());

  // --- Queries ---
  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.getAll();
      return res.data.data;
    },
  });

  const { data: roleDetails, isLoading: roleDetailsLoading } = useQuery<Role & { permissions: string[] }>({
    queryKey: ['roles', selectedRoleId],
    queryFn: async () => {
      const res = await rolesApi.getById(selectedRoleId!);
      return res.data.data;
    },
    enabled: !!selectedRoleId,
    staleTime: 0,
  });

  const { data: permissions, isLoading: permissionsLoading } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await rolesApi.getPermissions();
      return res.data.data;
    },
    staleTime: 1000 * 60 * 30,
  });

  // --- Mutations ---
  const createRole = useMutation({
    mutationFn: (data: { name: string; description: string; permissionKeys: string[] }) =>
      rolesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const updateRole = useMutation({
    mutationFn: async (vars: { roleId: string; data: { name?: string; description?: string; permissionKeys?: string[] } }) =>
      rolesApi.update(vars.roleId, vars.data),
    onSuccess: (_data: any, vars: { roleId: string; data: any }) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', vars.roleId] });
    },
  });

  const deleteRoleMut = useMutation({
    mutationFn: (roleId: string) => rolesApi.delete(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  // --- Group permissions by module ---
  const groupedPermissions = useMemo(() => {
    if (!permissions) return {};
    const grouped: Record<string, Permission[]> = {};
    for (const perm of permissions) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }
    return grouped;
  }, [permissions]);

  // --- Effect: populate permissions when editing ---
  useEffect(() => {
    if (roleDetails?.permissions && showEditModal && selectedRoleId) {
      setFormPermissions(new Set(roleDetails.permissions));
    }
  }, [roleDetails?.permissions, showEditModal, selectedRoleId]);

  // --- Handlers ---
  const handleOpenCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormPermissions(new Set());
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    if (formPermissions.size === 0) return;
    try {
      await createRole.mutateAsync({
        name: formName.trim(),
        description: formDescription.trim(),
        permissionKeys: Array.from(formPermissions),
      });
      setShowCreateModal(false);
    } catch { /* error shown from response */ }
  };

  const handleOpenEdit = (role: Role) => {
    setFormPermissions(new Set());
    setSelectedRoleId(role.id);
    setFormName(role.name);
    setFormDescription(role.description);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedRoleId || !formName.trim()) return;
    try {
      // System roles: only send permissionKeys (backend rejects name/description changes)
      const isSystem = selectedRole?.isSystemRole;
      await updateRole.mutateAsync({
        roleId: selectedRoleId,
        data: isSystem
          ? { permissionKeys: Array.from(formPermissions) }
          : {
              name: formName.trim(),
              description: formDescription.trim(),
              permissionKeys: Array.from(formPermissions),
            },
      });
      setShowEditModal(false);
      setSelectedRoleId(null);
    } catch { /* error shown from response */ }
  };

  const handleOpenDelete = (role: Role) => {
    setSelectedRoleId(role.id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!selectedRoleId) return;
    try {
      await deleteRoleMut.mutateAsync(selectedRoleId);
      setShowDeleteConfirm(false);
      setSelectedRoleId(null);
    } catch { /* error shown from response */ }
  };

  const togglePermission = (permKey: string) => {
    setFormPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return next;
    });
  };

  const toggleModule = (module: string) => {
    const modulePerms = groupedPermissions[module] || [];
    const moduleKeys = modulePerms.map((p) => p.key);
    const allSelected = moduleKeys.every((k) => formPermissions.has(k));
    setFormPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) moduleKeys.forEach((k) => next.delete(k));
      else moduleKeys.forEach((k) => next.add(k));
      return next;
    });
  };

  const selectedRole = useMemo(() => {
    return roles?.find((r) => r.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  // --- Loading ---
  if (rolesLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Loading roles and permissions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Roles &amp; Permissions</h2>
          <p className="text-sm text-gray-500">Manage roles and their permission assignments</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Create Role
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles?.map((role) => (
          <div
            key={role.id}
            className={cn(
              'bg-white rounded-lg shadow-sm border p-4 border-l-4',
              role.isSystemRole ? 'border-l-yellow-500' : 'border-l-blue-500'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{role.name}</h3>
                {role.isSystemRole && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mt-1 inline-block">
                    System Role
                  </span>
                )}
              </div>
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                {role.permissionCount} perms
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{role.description}</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => handleOpenEdit(role)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Pencil className="h-3.5 w-3.5" />
                {role.isSystemRole ? 'Edit Permissions' : 'Edit'}
              </button>
              {!role.isSystemRole && (
                <button
                  onClick={() => handleOpenDelete(role)}
                  className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {roles?.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
          No roles found. Create one to get started.
        </div>
      )}

      {/* ====== Create / Edit Modal ====== */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {showCreateModal ? 'Create Role' : `Edit Role: ${selectedRole?.name}`}
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedRoleId(null); }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {/* Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={selectedRole?.isSystemRole}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:bg-gray-100 text-sm"
                    placeholder="e.g., Sales Manager"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    disabled={selectedRole?.isSystemRole}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:bg-gray-100 text-sm"
                    placeholder="Describe the role's purpose"
                  />
                </div>
              </div>

              {/* Permissions Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Permissions ({formPermissions.size} selected)
                  </label>
                </div>

                {permissionsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading permissions catalog...</div>
                ) : roleDetailsLoading && showEditModal ? (
                  <div className="text-center py-8 text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading role permissions...
                  </div>
                ) : Object.keys(groupedPermissions).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No permissions available.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(groupedPermissions)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([module, perms]) => {
                        const moduleKeys = perms.map((p) => p.key);
                        const selectedCount = moduleKeys.filter((k) => formPermissions.has(k)).length;
                        const allSelected = selectedCount === moduleKeys.length;

                        return (
                          <div key={module} className="bg-gray-50 rounded-lg p-3 border">
                            <div className="flex items-center justify-between mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={() => toggleModule(module)}
                                  className="rounded text-primary focus:ring-primary"
                                />
                                <span className="font-medium text-gray-900 capitalize text-sm">{module}</span>
                              </label>
                              <span className="text-xs text-gray-500">{selectedCount}/{perms.length}</span>
                            </div>
                            <div className="space-y-1 ml-6">
                              {perms.map((perm) => (
                                <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formPermissions.has(perm.key)}
                                    onChange={() => togglePermission(perm.key)}
                                    className="rounded text-primary focus:ring-primary"
                                  />
                                  <span className="text-gray-700">{perm.action}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedRoleId(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreate : handleUpdate}
                disabled={createRole.isPending || updateRole.isPending || !formName.trim() || formPermissions.size === 0}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {(createRole.isPending || updateRole.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {createRole.isPending || updateRole.isPending
                  ? 'Saving...'
                  : showCreateModal ? 'Create Role' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Delete Confirmation Modal ====== */}
      {showDeleteConfirm && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Role</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the role <strong>"{selectedRole.name}"</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setSelectedRoleId(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteRoleMut.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {deleteRoleMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleteRoleMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SYSTEM SETTINGS TAB
// ============================================================================

function SystemSettingsTab() {
  const queryClient = useQueryClient();
  const { refreshSettings } = useSettings();
  const [activeSection, setActiveSection] = useState<'general' | 'tax' | 'receipt' | 'alerts'>('general');
  const [formData, setFormData] = useState<Partial<SystemSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const res = await systemApi.getSettings();
      return res.data.data as SystemSettings;
    },
  });

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  // Update form field
  const updateField = (field: keyof SystemSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SystemSettings>) => {
      const res = await systemApi.updateSettings(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      refreshSettings();
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSave = () => {
    if (!hasChanges) return;
    // Only send changed fields
    const changedFields: Partial<SystemSettings> = {};
    if (settings) {
      for (const key of Object.keys(formData) as (keyof SystemSettings)[]) {
        if (formData[key] !== settings[key]) {
          (changedFields as any)[key] = formData[key];
        }
      }
    }
    if (Object.keys(changedFields).length > 0) {
      saveMutation.mutate(changedFields);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-500">Loading settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <AlertTriangle className="h-5 w-5 inline mr-2" />
        Failed to load settings. Please try again.
      </div>
    );
  }

  const sections = [
    { id: 'general' as const, label: 'General', icon: Building2 },
    { id: 'tax' as const, label: 'Tax', icon: Receipt },
    { id: 'receipt' as const, label: 'Receipt & Printing', icon: Receipt },
    { id: 'alerts' as const, label: 'Alerts', icon: Bell },
  ];

  return (
    <div className="flex gap-6">
      {/* Section Navigation */}
      <div className="w-48 flex-shrink-0">
        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors',
                  activeSection === section.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Section Content */}
      <div className="flex-1 min-w-0">
        {/* Save Bar */}
        {(hasChanges || saveSuccess || saveMutation.isError) && (
          <div className={cn(
            'mb-4 px-4 py-3 rounded-lg flex items-center justify-between',
            saveSuccess ? 'bg-green-50 border border-green-200' :
            saveMutation.isError ? 'bg-red-50 border border-red-200' :
            'bg-yellow-50 border border-yellow-200'
          )}>
            <div className="flex items-center gap-2">
              {saveSuccess && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {saveMutation.isError && <XCircle className="h-4 w-4 text-red-600" />}
              {!saveSuccess && !saveMutation.isError && <Info className="h-4 w-4 text-yellow-600" />}
              <span className={cn(
                'text-sm font-medium',
                saveSuccess ? 'text-green-700' :
                saveMutation.isError ? 'text-red-700' :
                'text-yellow-700'
              )}>
                {saveSuccess ? 'Settings saved successfully!' :
                 saveMutation.isError ? `Failed to save: ${(saveMutation.error as any)?.response?.data?.error || 'Unknown error'}` :
                 'You have unsaved changes'}
              </span>
            </div>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            )}
          </div>
        )}

        {/* General Settings */}
        {activeSection === 'general' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Business information and regional preferences</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Business Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Business Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      value={formData.businessName || ''}
                      onChange={e => updateField('businessName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="Your Business Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={formData.businessPhone || ''}
                      onChange={e => updateField('businessPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="+256 700 000 000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.businessEmail || ''}
                      onChange={e => updateField('businessEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="contact@yourbusiness.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.businessAddress || ''}
                      onChange={e => updateField('businessAddress', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="Your business address"
                    />
                  </div>
                </div>
              </div>

              {/* Regional Settings */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Regional Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency Code</label>
                    <select
                      value={formData.currencyCode || 'UGX'}
                      onChange={e => updateField('currencyCode', e.target.value)}
                      title="Currency Code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                    >
                      <option value="UGX">UGX - Ugandan Shilling</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="KES">KES - Kenyan Shilling</option>
                      <option value="TZS">TZS - Tanzanian Shilling</option>
                      <option value="RWF">RWF - Rwandan Franc</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
                    <input
                      type="text"
                      value={formData.currencySymbol || ''}
                      onChange={e => updateField('currencySymbol', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="UGX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                    <select
                      value={formData.dateFormat || 'YYYY-MM-DD'}
                      onChange={e => updateField('dateFormat', e.target.value)}
                      title="Date Format"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-01-29)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (29/01/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (01/29/2026)</option>
                      <option value="DD-MM-YYYY">DD-MM-YYYY (29-01-2026)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Format</label>
                    <select
                      value={formData.timeFormat || '24h'}
                      onChange={e => updateField('timeFormat', e.target.value)}
                      title="Time Format"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                    >
                      <option value="24h">24-hour (14:30)</option>
                      <option value="12h">12-hour (2:30 PM)</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                    <select
                      value={formData.timezone || 'Africa/Kampala'}
                      onChange={e => updateField('timezone', e.target.value)}
                      title="Timezone"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                    >
                      <option value="Africa/Kampala">Africa/Kampala (EAT, UTC+3)</option>
                      <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
                      <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam (EAT, UTC+3)</option>
                      <option value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</option>
                      <option value="Africa/Cairo">Africa/Cairo (EET, UTC+2)</option>
                      <option value="UTC">UTC (UTC+0)</option>
                      <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                      <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tax Settings */}
        {activeSection === 'tax' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Tax Configuration</h3>
              <p className="text-sm text-gray-500 mt-1">Configure tax calculation for your business</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Tax Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable Tax</h4>
                  <p className="text-sm text-gray-500">Apply tax to taxable products during sales</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.taxEnabled ?? true}
                    onChange={e => updateField('taxEnabled', e.target.checked)}
                    title="Enable Tax"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {formData.taxEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Name</label>
                    <input
                      type="text"
                      value={formData.taxName || ''}
                      onChange={e => updateField('taxName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="e.g. VAT, GST, Sales Tax"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number / TIN</label>
                    <input
                      type="text"
                      value={formData.taxNumber || ''}
                      onChange={e => updateField('taxNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="Your tax identification number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.defaultTaxRate ?? 18}
                      onChange={e => updateField('defaultTaxRate', parseFloat(e.target.value) || 0)}
                      title="Default Tax Rate"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Stored as percentage (e.g. 18 = 18%)</p>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.taxInclusive ?? false}
                        onChange={e => updateField('taxInclusive', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Tax Inclusive Pricing</span>
                        <p className="text-xs text-gray-500">Selling prices already include tax</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Receipt & Printing Settings */}
        {activeSection === 'receipt' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Receipt & Printing</h3>
              <p className="text-sm text-gray-500 mt-1">Customize receipt content and printing options</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Receipt Content */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Receipt Content</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Header Text</label>
                    <textarea
                      value={formData.receiptHeaderText || ''}
                      onChange={e => updateField('receiptHeaderText', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="Text printed at the top of each receipt (e.g. business name, address, TIN)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
                    <textarea
                      value={formData.receiptFooterText || ''}
                      onChange={e => updateField('receiptFooterText', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      placeholder="Thank you for your business!"
                    />
                  </div>
                </div>
              </div>

              {/* Print Options */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Print Options</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paper Width</label>
                    <select
                      value={formData.receiptPaperWidth ?? 80}
                      onChange={e => updateField('receiptPaperWidth', parseInt(e.target.value))}
                      title="Paper Width"
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                    >
                      <option value={58}>58mm (Small thermal)</option>
                      <option value={80}>80mm (Standard thermal)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.receiptShowTaxBreakdown ?? true}
                      onChange={e => updateField('receiptShowTaxBreakdown', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Show Tax Breakdown</span>
                      <p className="text-xs text-gray-500">Display itemized tax amounts on receipts</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.receiptAutoPrint ?? false}
                      onChange={e => updateField('receiptAutoPrint', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Auto-Print Receipts</span>
                      <p className="text-xs text-gray-500">Automatically print receipt after completing a sale</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alert Settings */}
        {activeSection === 'alerts' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Alerts & Notifications</h3>
              <p className="text-sm text-gray-500 mt-1">Configure system alerts and thresholds</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Low Stock Alerts */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Low Stock Alerts</h4>
                  <p className="text-sm text-gray-500">Get notified when products fall below threshold</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.lowStockAlertsEnabled ?? true}
                    onChange={e => updateField('lowStockAlertsEnabled', e.target.checked)}
                    title="Low Stock Alerts"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {formData.lowStockAlertsEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Low Stock Threshold</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={formData.lowStockThreshold ?? 10}
                      onChange={e => updateField('lowStockThreshold', parseInt(e.target.value) || 0)}
                      title="Low Stock Threshold"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                    />
                    <span className="text-sm text-gray-500">units</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Products with quantity below this threshold will trigger a low stock alert.
                    Individual products can override this in their settings.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DATA MANAGEMENT TAB
// ============================================================================

function DataManagementTab() {
  const [activeSection, setActiveSection] = useState<'overview' | 'reset'>('overview');

  return (
    <div className="space-y-6">
      {/* Section Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveSection('overview')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
            activeSection === 'overview'
              ? 'bg-primary text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          )}
        >
          <HardDrive className="h-4 w-4" />
          Database Overview
        </button>
        <button
          onClick={() => setActiveSection('reset')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
            activeSection === 'reset'
              ? 'bg-red-600 text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          )}
        >
          <Trash2 className="h-4 w-4" />
          Reset Data
        </button>
      </div>

      {activeSection === 'overview' && <DatabaseOverviewSection />}
      {activeSection === 'reset' && <DataResetSection />}
    </div>
  );
}

// ============================================================================
// DATABASE OVERVIEW SECTION
// ============================================================================

function DatabaseOverviewSection() {
  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['database-stats'],
    queryFn: async () => {
      const res = await systemApi.getDatabaseStats();
      return res.data.data as DatabaseStats;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-500">Loading database statistics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <AlertTriangle className="h-5 w-5 inline mr-2" />
        Failed to load database statistics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HardDrive className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Database Size</p>
              <p className="text-xl font-bold text-gray-900">{stats?.databaseSize || 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Database className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Records</p>
              <p className="text-xl font-bold text-gray-900">{stats?.totalRecords?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tables</p>
              <p className="text-xl font-bold text-gray-900">
                {((stats?.masterData?.length || 0) + (stats?.transactionalData?.length || 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Master Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            Master Data
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-normal">Protected</span>
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {stats?.masterData?.map((table) => (
            <div key={table.name} className="px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">{table.name}</span>
              <span className="text-sm font-medium text-gray-900">{table.count.toLocaleString()}</span>
            </div>
          ))}
          {(!stats?.masterData || stats.masterData.length === 0) && (
            <div className="px-6 py-4 text-sm text-gray-500 text-center">No data available</div>
          )}
        </div>
      </div>

      {/* Transactional Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600" />
            Transactional Data
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-normal">Clearable</span>
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {stats?.transactionalData?.map((table) => (
            <div key={table.name} className="px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">{table.name}</span>
              <span className="text-sm font-medium text-gray-900">{table.count.toLocaleString()}</span>
            </div>
          ))}
          {(!stats?.transactionalData || stats.transactionalData.length === 0) && (
            <div className="px-6 py-4 text-sm text-gray-500 text-center">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DATA RESET SECTION
// ============================================================================

function DataResetSection() {
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetComplete, setResetComplete] = useState(false);

  // Fetch reset preview
  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['reset-preview'],
    queryFn: async () => {
      const res = await systemApi.getResetPreview();
      return res.data.data as ResetPreview;
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async (data: { confirmText: string; reason: string }) => {
      const res = await systemApi.executeReset(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowConfirmDialog(false);
      setConfirmText('');
      setResetReason('');
      setResetComplete(true);
    },
  });

  const canConfirm = confirmText === 'RESET ALL TRANSACTIONS' && resetReason.length >= 10;

  const handleReset = () => {
    if (!canConfirm) return;
    resetMutation.mutate({ confirmText, reason: resetReason });
  };

  if (resetComplete) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-green-900 mb-2">Reset Complete</h3>
        <p className="text-sm text-green-700 mb-4">
          All transactional data has been cleared. Master data (products, customers, suppliers, users) has been preserved.
        </p>
        <button
          onClick={() => setResetComplete(false)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700"
        >
          <RefreshCw className="h-4 w-4" />
          Back to Data Management
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-800">Danger Zone</h4>
            <p className="text-sm text-red-700 mt-1">
              Resetting data will <strong>permanently delete</strong> all transactional records including sales, invoices, 
              purchase orders, goods receipts, inventory batches, stock movements, and cash register sessions. 
              This action <strong>cannot be undone</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* What Will Be Affected */}
      {previewLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-gray-500">Loading preview...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Will Be Cleared */}
          <div className="bg-white rounded-lg border border-red-200 shadow-sm">
            <div className="px-6 py-4 border-b border-red-100 bg-red-50">
              <h3 className="text-md font-semibold text-red-800 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Will Be Cleared
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {preview?.willBeCleared?.map((item) => (
                <div key={item.name} className="px-6 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <span className={cn(
                    'text-sm font-medium',
                    item.count > 0 ? 'text-red-600' : 'text-gray-400'
                  )}>
                    {item.count.toLocaleString()} records
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Will Be Preserved */}
          <div className="bg-white rounded-lg border border-green-200 shadow-sm">
            <div className="px-6 py-4 border-b border-green-100 bg-green-50">
              <h3 className="text-md font-semibold text-green-800 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Will Be Preserved
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {preview?.willBePreserved?.map((item) => (
                <div key={item.name} className="px-6 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <span className="text-sm font-medium text-green-600">{item.count.toLocaleString()} records</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowConfirmDialog(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Reset Transactional Data
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            {/* Dialog Header */}
            <div className="bg-red-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Confirm Data Reset
              </h3>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                This will permanently delete all transactional data. Master data (products, customers, suppliers, users) will be preserved.
              </p>

              {resetMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  <XCircle className="h-4 w-4 inline mr-1" />
                  {(resetMutation.error as any)?.response?.data?.error || 'Reset failed. Please try again.'}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for reset <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 text-sm"
                  placeholder="Describe why you are resetting the data (min 10 characters)..."
                />
                {resetReason.length > 0 && resetReason.length < 10 && (
                  <p className="text-xs text-red-500 mt-1">Minimum 10 characters required ({resetReason.length}/10)</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600 font-mono text-xs">RESET ALL TRANSACTIONS</code> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 border rounded-md shadow-sm text-sm font-mono',
                    confirmText === 'RESET ALL TRANSACTIONS'
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-red-500 focus:border-red-500'
                  )}
                  placeholder="RESET ALL TRANSACTIONS"
                />
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmText('');
                  setResetReason('');
                }}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={!canConfirm || resetMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {resetMutation.isPending ? 'Resetting...' : 'Reset All Transactional Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
