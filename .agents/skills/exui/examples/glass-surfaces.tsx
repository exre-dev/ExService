import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  GlassSeed,
  Input,
  InputGroup,
  InputGroupInput,
  SelectContent,
  SelectField,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@exre/exui'
import '@exre/exui/style.css'

/**
 * One seed per document registers the shared refraction filter. It renders no
 * children and is not a provider. Omit it for the base material; syntax support
 * alone does not establish rendered refraction quality in the target browser.
 */
export default function GlassSurfaces() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <TooltipProvider>
      <GlassSeed />

      {/* A real backdrop is what makes a translucent surface worth looking at. */}
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          padding: '1.5rem',
          backgroundImage:
            'repeating-linear-gradient(45deg, #1d4ed8 0 14px, #0f172a 14px 28px, #e11d48 28px 42px, #f8fafc 42px 56px)',
        }}
      >
        <Card glass>
          <CardHeader>
            <CardTitle>Glass card</CardTitle>
            <CardDescription>
              The material replaces the surface colour and keeps the component's own radius,
              padding, shadow, and states.
            </CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <Button glass>Neutral</Button>
            {/* Danger surfaces keep the danger material and its foreground. */}
            <Button glass variant="danger">
              Danger
            </Button>
            <Badge glass variant="destructive">
              Destructive
            </Badge>
          </CardContent>
        </Card>

        {/*
          Any element can use the material through the class, without a React
          component and without a glass prop.
        */}
        <div className="ex-glass" style={{ borderRadius: '0.75rem', padding: '1rem' }}>
          A plain div material
        </div>

        <InputGroup glass>
          <InputGroupInput placeholder="Input group" aria-label="Glass input group" />
        </InputGroup>
        <Input glass placeholder="Input" aria-label="Glass input" />

        {/* Trigger and portal panel opt in separately. */}
        <SelectField defaultValue="all">
          <SelectTrigger glass aria-label="Visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent glass>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="saved">Saved items</SelectItem>
          </SelectContent>
        </SelectField>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            {/* Portal content shares the seed of the document it renders into. */}
            <DialogContent glass>
              <DialogHeader>
                <DialogTitle>Glass dialog</DialogTitle>
                <DialogDescription>
                  The surface and the backdrop both follow the theme in effect where the portal
                  renders.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Open drawer</Button>
            </DrawerTrigger>
            {/* The rounded surface is painted on the content's ::before. */}
            <DrawerContent glass>
              <DrawerHeader>
                <DrawerTitle>Glass drawer</DrawerTitle>
                <DrawerDescription>Drag the panel to close it.</DrawerDescription>
              </DrawerHeader>
            </DrawerContent>
          </Drawer>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent glass>Tip</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
