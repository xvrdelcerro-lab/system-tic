'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useFormContext, FormProvider, useForm } from 'react-hook-form';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InputWithDecimals } from '@/components/ui/input-with-decimals';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/use-products';
import type { Phase } from '@/lib/types';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useProduction } from '@/hooks/use-production';
import { usePhases } from '@/hooks/use-phases';
import { useInventory } from '@/hooks/use-inventory';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

const rowSchema = z.object({
  productId: z.string().optional(),
  phaseData: z.array(z.object({
      piecesToProduce: z.coerce.number().optional(),
      quantity: z.coerce.number().optional(),
      damagedQuantity: z.coerce.number().optional(),
  }))
});

const formSchema = z.object({
  rows: z.array(rowSchema)
});

export type FormSchemaType = z.infer<typeof formSchema>;


function ProductionFormRow({ 
  phase, 
  showLabels, 
  phaseIndex,
  rowIndex,
}: { 
  phase: Phase, 
  showLabels: boolean, 
  phaseIndex: number,
  rowIndex: number,
}) {
  const t = useTranslations('ProductionPage');
  const tCommon = useTranslations('ProtectedPage');
  const tData = useTranslations('DefaultData.PhasesData');
  const tScales = useTranslations('DefaultData.scaleNames');
  const { toast } = useToast();
  const { control, getValues, setValue, trigger, watch, resetField } = useFormContext();
  const { recordAndAdvanceProduction } = useProduction();
  const { phases } = usePhases();
  const { products } = useProducts();
  const { allItems: allRawMaterials } = useInventory();
  const [isRecording, setIsRecording] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const isActive = true;

  const lastCorrectedValue = useRef<number | undefined>();
  
  const productIdPath = `rows.${rowIndex}.phaseData.${phaseIndex}.productId`;
  const allPhaseDataPath = `rows.${rowIndex}.phaseData`;
  const entryPhaseIndexPath = `rows.${rowIndex}.entryPhaseIndex`;
  const piecesToProducePath = `rows.${rowIndex}.phaseData.${phaseIndex}.piecesToProduce`;
  const quantityPath = `rows.${rowIndex}.phaseData.${phaseIndex}.quantity`;
  const damagedPath = `rows.${rowIndex}.phaseData.${phaseIndex}.damagedQuantity`;
  
  const watchedProductIdForRow = watch(productIdPath);
  const allPhaseDataForRow = watch(allPhaseDataPath);
  const entryPhaseIndex = watch(entryPhaseIndexPath);
  const watchedToProduce = watch(piecesToProducePath) || 0;
  const watchedProduced = watch(quantityPath) || 0;
  const watchedDamaged = watch(damagedPath) || 0;

  const isProductSelected = !!watchedProductIdForRow;
  
  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  const translatedPhaseName = tData.has(phase.name) ? tData(phase.name) : phase.name;

  const selectedProduct = sortedProducts.find(p => p.id === watchedProductIdForRow);
  const totalProducedWeight = useMemo(() => {
    if (!selectedProduct || !selectedProduct.unitAmount) return null;
    const totalPieces = watchedProduced + watchedDamaged;
    if (totalPieces === 0) return null;
    const weight = totalPieces * selectedProduct.unitAmount;
    const scaleName = selectedProduct.unitScale || 'Piece';
    const translatedScale = tScales.has(scaleName) ? tScales(scaleName) : scaleName;
    return `${weight.toFixed(2)} ${translatedScale}`;
  }, [selectedProduct, watchedProduced, watchedDamaged, tScales]);

  const isEntryPoint = useMemo(() => {
    if (!isProductSelected) return false;
    const allPhaseData = getValues(allPhaseDataPath) || [];
    const firstPhaseWithWorkIndex = allPhaseData.findIndex((pd: any) => (pd?.piecesToProduce || 0) > 0);
    if (firstPhaseWithWorkIndex === -1) {
      return true;
    }
    return phaseIndex === firstPhaseWithWorkIndex;
  }, [allPhaseDataForRow, phaseIndex, isProductSelected, getValues, allPhaseDataPath]);

  const shouldLockProduct = useMemo(() => {
    if (entryPhaseIndex === undefined || entryPhaseIndex === null) {
      return false;
    }
    
    if (phaseIndex < entryPhaseIndex) {
      return false;
    }
    
    if (watchedToProduce === 0) {
      const allPhases = getValues(allPhaseDataPath) as any[] || [];
      for (let i = entryPhaseIndex; i < phaseIndex; i++) {
        const phaseData = allPhases[i];
        if ((phaseData?.piecesToProduce || 0) > 0) {
          return true;
        }
      }
      return false;
    }
    
    return true;
  }, [watchedToProduce, entryPhaseIndex, phaseIndex, getValues, allPhaseDataPath, allPhaseDataForRow]);

  const handleToProduceBlur = () => {
    const currentToProduce = getValues(piecesToProducePath) || 0;
    
    if (currentToProduce > 0 && isEntryPoint) {
      setValue(entryPhaseIndexPath, phaseIndex);
      
      const currentProductId = getValues(productIdPath);
      if (currentProductId) {
        for (let i = phaseIndex + 1; i < phases.length; i++) {
          setValue(`rows.${rowIndex}.phaseData.${i}.productId`, currentProductId);
        }
      }
    }
  };

  const handlePiecesToProduceChange = (onChange: (...event: any[]) => void, value: number | undefined) => {
    const quantityToProduce = value || 0;

    if (!isEntryPoint || !watchedProductIdForRow || quantityToProduce <= 0) {
      if (value !== lastCorrectedValue.current) {
        setValidationMessage(null);
      }
      lastCorrectedValue.current = undefined;
      onChange(value);
      return;
    }

    const product = products.find(p => p.id === watchedProductIdForRow);
    if (!product || !product.components || product.components.length === 0) {
      if (value !== lastCorrectedValue.current) {
        setValidationMessage(null);
      }
      lastCorrectedValue.current = undefined;
      onChange(value);
      return;
    }

    let maxProducible = Infinity;
    let bottleneckMaterial = '';

    for (const component of product.components) {
      const material = allRawMaterials.find(m => m.id === component.rawMaterialId);
      if (!material) {
        console.warn(`Material with ID ${component.rawMaterialId} not found.`);
        continue;
      }

      const availableStock = material.quantity || 0;
      const requiredPerPiece = component.quantity;
      
      if (requiredPerPiece > 0) {
        const producibleWithThisMaterial = Math.floor(availableStock / requiredPerPiece);
        if (producibleWithThisMaterial < maxProducible) {
          maxProducible = producibleWithThisMaterial;
          bottleneckMaterial = material.item;
        }
      }
    }

    if (quantityToProduce > maxProducible) {
        const correctedValue = maxProducible > 0 ? maxProducible : undefined;
        lastCorrectedValue.current = correctedValue;
        onChange(correctedValue);
        setValidationMessage(`Not enough ${bottleneckMaterial}. Maximum producible: ${maxProducible}.`);
    } else {
        if (value !== lastCorrectedValue.current) {
            setValidationMessage(null);
        }
        lastCorrectedValue.current = undefined;
        onChange(value);
    }
  };

  const onSubmit = async () => {
    const currentProductId = getValues(productIdPath);
    
    if (!isProductSelected) {
        toast({ variant: 'destructive', title: t('toasts.validationErrorTitle'), description: t('toasts.selectProductError') });
        return;
    }
    
    if (!isEntryPoint && !(getValues(piecesToProducePath) > 0)) {
        toast({ variant: 'destructive', title: t('toasts.validationErrorTitle'), description: t('toasts.noPiecesToProduceError') });
        return;
    }

    const piecesToProduceValid = await trigger(piecesToProducePath);
    const quantityValid = await trigger(quantityPath);
    const damagedValid = await trigger(damagedPath);
    
    if (!piecesToProduceValid || !quantityValid || !damagedValid) {
        return;
    }
    
    const goodQuantity = getValues(quantityPath) || 0;
    const damagedQuantity = getValues(damagedPath) || 0;
    const currentPiecesToProduce = getValues(piecesToProducePath) || 0;

    const totalProcessed = goodQuantity + damagedQuantity;

    if (totalProcessed === 0 && (isEntryPoint ? !currentPiecesToProduce : true)) {
        toast({ variant: 'destructive', title: t('toasts.validationErrorTitle'), description: t('toasts.enterQuantityError') });
        return;
    }

    const totalToProcess = isEntryPoint ? (currentPiecesToProduce || totalProcessed) : currentPiecesToProduce;

    if (totalProcessed > totalToProcess) {
      toast({ 
        variant: 'destructive', 
        title: t('toasts.validationErrorTitle'), 
        description: t('toasts.totalProcessedError', { totalProcessed, totalToProcess })
      });
      return;
    }
    
    const product = sortedProducts.find(p => p.id === currentProductId);
    if (!product) {
      toast({ variant: 'destructive', title: t('toasts.validationErrorTitle'), description: t('toasts.productNotFoundError') });
      return;
    }

    setIsRecording(true);
    
    try {
        const nextPhaseIndex = phaseIndex + 1;
        const nextPhase = nextPhaseIndex < phases.length ? phases[nextPhaseIndex] : null;

        await recordAndAdvanceProduction(
            `row-${rowIndex}`,
            currentProductId,
            product.name,
            phase,
            nextPhase,
            goodQuantity,
            damagedQuantity,
            isEntryPoint
        );

        let weightMessage = '';
        if (product.unitAmount && product.unitScale) {
          const totalWeight = totalProcessed * product.unitAmount;
          const scaleName = product.unitScale;
          const translatedScale = tScales.has(scaleName) ? tScales(scaleName) : scaleName;
          weightMessage = ` (${totalWeight.toFixed(2)} ${translatedScale})`;
        }

        toast({
            title: t('toasts.productionLoggedTitle'),
            description: `${totalProcessed} pieces${weightMessage} of ${product.name} processed in ${translatedPhaseName} (${goodQuantity} good, ${damagedQuantity} damaged)`,
        });

        const remainingPieces = totalToProcess - totalProcessed;
        setValue(piecesToProducePath, remainingPieces > 0 ? remainingPieces : undefined, { shouldValidate: true });
        
        resetField(quantityPath);
        resetField(damagedPath);

        if (goodQuantity > 0 && nextPhase) {
            const nextPhasePiecesToProducePath = `rows.${rowIndex}.phaseData.${nextPhaseIndex}.piecesToProduce`;
            const currentNextPhaseValue = getValues(nextPhasePiecesToProducePath) || 0;
            setValue(nextPhasePiecesToProducePath, currentNextPhaseValue + goodQuantity, { shouldDirty: true });
        }
        
        const allPhaseDataAfterSubmit = getValues(allPhaseDataPath);
        let newTotalWip = 0;
        if(Array.isArray(allPhaseDataAfterSubmit)) {
            newTotalWip = allPhaseDataAfterSubmit.reduce((acc, pd) => acc + (pd?.piecesToProduce || 0), 0);
        }
        
        if (newTotalWip <= 0) {
             toast({
                title: t('toasts.productionCompleteTitle'),
                description: t('toasts.productionCompleteDesc', { productName: product.name }),
             });
             setValue(entryPhaseIndexPath, undefined);
             for(let i=0; i<phases.length; i++) {
                 resetField(`rows.${rowIndex}.phaseData.${i}.productId`);
                 resetField(`rows.${rowIndex}.phaseData.${i}.piecesToProduce`);
             }
        } else if (remainingPieces <= 0) {
             toast({
              title: t('toasts.phaseRowCompleteTitle'),
              description: t('toasts.phaseRowCompleteDesc', { phaseName: translatedPhaseName }),
             });
        }
    } catch (error) {
        console.error('Failed to record production event:', error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            variant: 'destructive',
            title: t('toasts.recordingFailedTitle'),
            description: message,
        });
    } finally {
        setIsRecording(false);
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2 md:gap-4">
        <div className="w-full md:w-1/3">
          <FormField
            control={control}
            name={productIdPath as any}
            render={({ field }) => (
              <FormItem>
                {showLabels && <FormLabel>{t('form.productLabel')}</FormLabel>}
                {shouldLockProduct && field.value ? (
                  <FormControl>
                    <Input
                      value={sortedProducts.find(p => p.id === field.value)?.name || ''}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </FormControl>
                ) : (
                  <Select 
                    onValueChange={(value) => {
                      setValue(productIdPath, value, { shouldDirty: true, shouldValidate: true });
                    }} 
                    value={field.value || ''}
                    disabled={shouldLockProduct}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.selectProductPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex-1">
            <FormField
            control={control}
            name={piecesToProducePath as any}
            render={({ field }) => (
                <FormItem>
                {showLabels && <FormLabel>{t('form.toProduceLabel')}</FormLabel>}
                <FormControl>
                    <InputWithDecimals
                        placeholder="0"
                        name={field.name}
                        ref={field.ref}
                        value={field.value ?? ''}
                        onValueChange={(values) => {
                            handlePiecesToProduceChange(field.onChange, values.floatValue === undefined ? undefined : values.floatValue)
                        }}
                        onBlur={handleToProduceBlur}
                        readOnly={shouldLockProduct}
                        className={cn(shouldLockProduct && 'bg-muted')}
                    />
                </FormControl>
                {validationMessage && <p className="text-sm font-medium text-destructive mt-1">{validationMessage}</p>}
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="flex-1">
            <FormField
            control={control}
            name={quantityPath as any}
            render={({ field }) => (
                <FormItem>
                {showLabels && <FormLabel>{t('form.producedLabel')}</FormLabel>}
                <FormControl>
                    <InputWithDecimals
                        placeholder="0"
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        value={field.value ?? ''}
                        onValueChange={(values) => {
                            field.onChange(values.floatValue === undefined ? undefined : values.floatValue)
                        }}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="flex-1">
            <FormField
            control={control}
            name={damagedPath as any}
            render={({ field }) => (
                <FormItem>
                {showLabels && <FormLabel>{t('form.damagedLabel')}</FormLabel>}
                <FormControl>
                      <InputWithDecimals
                        placeholder="0"
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        value={field.value ?? ''}
                        onValueChange={(values) => {
                            field.onChange(values.floatValue === undefined ? undefined : values.floatValue)
                        }}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div>
            <Button type="button" onClick={onSubmit} disabled={isRecording} className="w-full md:w-auto bg-[#3560A0] hover:bg-[#3560A0]/90">
                {isRecording ? <Loader2 className="h-4 w-4 animate-spin" /> : t('form.recordButton')}
            </Button>
        </div>
      </div>
      {totalProducedWeight && (watchedProduced > 0 || watchedDamaged > 0) && (
        <div className="text-sm text-muted-foreground pl-2">
          Total: {watchedProduced + watchedDamaged} pieces = <span className="font-semibold text-foreground">{totalProducedWeight}</span>
        </div>
      )}
    </div>
  );
}

function ProductionPhaseCard({ phase, phaseIndex }: { phase: Phase, phaseIndex: number }) {
  const tData = useTranslations('DefaultData.PhasesData');
  const { watch } = useFormContext();

  const rows = watch('rows');

  const translatedPhaseName = tData.has(phase.name) ? tData(phase.name) : phase.name;
  const translatedPhaseDescription = tData.has(`${phase.name}_desc`) ? tData(`${phase.name}_desc`) : phase.description;

  return (
    <Card className="border bg-background">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{translatedPhaseName}</CardTitle>
            <CardDescription>{translatedPhaseDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => {
           const productForRow = rows?.[index]?.productId;
           return (
            <ProductionFormRow 
                key={`${phase.id}-${index}-${productForRow || 'no-prod'}`} 
                phase={phase} 
                showLabels={index === 0} 
                phaseIndex={phaseIndex}
                rowIndex={index}
            />
           )
        })}
      </CardContent>
    </Card>
  );
}

function ProductionContent() {
    const t = useTranslations('ProductionPage');
    const { phases, loading } = usePhases();
    const isActive = true;
    
    const generateDefaultValues = useCallback((p: Phase[]) => ({
      rows: Array(5).fill(null).map(() => ({
        productId: '',
        phaseData: Array(p.length).fill(null).map(() => ({
            piecesToProduce: undefined,
            quantity: undefined,
            damagedQuantity: undefined,
        }))
      }))
    }), []);

    const formMethods = useForm<FormSchemaType>({
      resolver: zodResolver(formSchema),
      defaultValues: generateDefaultValues(phases),
      mode: 'onBlur',
    });

    useEffect(() => {
      if (phases.length > 0) {
        formMethods.reset(generateDefaultValues(phases));
      }
    }, [phases, formMethods, generateDefaultValues]);


    if (loading) {
      return (
          <div className="space-y-8">
              <h1 className="text-3xl font-bold tracking-tight font-headline">
                  {t('title')}
              </h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {[...Array(2)].map((_, i) => (
                      <Card key={i} className="border bg-background">
                          <CardHeader>
                              <CardTitle><Loader2 className="h-6 w-6 animate-spin" /></CardTitle>
                              <CardDescription>{t('loading')}</CardDescription>
                          </CardHeader>
                          <CardContent>
                             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </CardContent>
                      </Card>
                  ))}
              </div>
          </div>
      )
    }

    return (
        <FormProvider {...formMethods}>
            <div className="space-y-8">
                <Alert variant="default" className="block md:hidden">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('desktop.title')}</AlertTitle>
                    <AlertDescription>
                    {t('desktop.description')}
                    </AlertDescription>
                </Alert>
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    {t('title')}
                </h1>
            
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {phases.map((phase, index) => (
                        <ProductionPhaseCard 
                            key={phase.id} 
                            phase={phase} 
                            phaseIndex={index} 
                        />
                    ))}
                </div>
            </div>
        </FormProvider>
    )
}

export default function ProductionPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
        const t = useTranslations('ProductionPage');
    const [isClient, setIsClient] = useState(false);
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    if (permissionLoading || !isClient) {
        return (
    <ProtectedPage pageName="production" pageTitle="Production">

            <div className="space-y-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    {t('title')}
                </h1>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="border bg-background">
                        <CardHeader>
                            <CardTitle><Loader2 className="h-6 w-6 animate-spin" /></CardTitle>
                            <CardDescription>{t('loading')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                     <Card className="border bg-background">
                        <CardHeader>
                            <CardTitle><Loader2 className="h-6 w-6 animate-spin" /></CardTitle>
                            <CardDescription>{t('loading')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        
    </ProtectedPage>
  )
    }

    if (!hasAccess('production')) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">{tCommon('accessDenied.title')}</h1>
                <Alert variant="destructive">
                    <AlertTitle>{tCommon('accessDenied.title')}</AlertTitle>
                    <AlertDescription>
                        {tCommon('accessDenied.description')}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

  return (
    <ProtectedPage pageName="production" pageTitle="Production">
<ProductionContent />
    </ProtectedPage>
  );
}