do $constraint$
begin
    -- Ensure breed_dog_categories.breed_id references breeds.id
    if not exists (
        select 1
        from pg_constraint
        where conname = 'breed_dog_categories_breed_id_fkey'
            and conrelid = 'public.breed_dog_categories'::regclass
    ) then
        alter table public.breed_dog_categories
            add constraint breed_dog_categories_breed_id_fkey
            foreign key (breed_id)
            references public.breeds (id)
            on delete cascade;
    end if;

    -- Ensure breed_dog_categories.dog_category_id references dog_categories.id
    if not exists (
        select 1
        from pg_constraint
        where conname = 'breed_dog_categories_dog_category_id_fkey'
            and conrelid = 'public.breed_dog_categories'::regclass
    ) then
        alter table public.breed_dog_categories
            add constraint breed_dog_categories_dog_category_id_fkey
            foreign key (dog_category_id)
            references public.dog_categories (id)
            on delete cascade;
    end if;

    -- Ensure breed_dog_types.breed_id references breeds.id
    if not exists (
        select 1
        from pg_constraint
        where conname = 'breed_dog_types_breed_id_fkey'
            and conrelid = 'public.breed_dog_types'::regclass
    ) then
        alter table public.breed_dog_types
            add constraint breed_dog_types_breed_id_fkey
            foreign key (breed_id)
            references public.breeds (id)
            on delete cascade;
    end if;

    -- Ensure breed_dog_types.dog_type_id references dog_types.id
    if not exists (
        select 1
        from pg_constraint
        where conname = 'breed_dog_types_dog_type_id_fkey'
            and conrelid = 'public.breed_dog_types'::regclass
    ) then
        alter table public.breed_dog_types
            add constraint breed_dog_types_dog_type_id_fkey
            foreign key (dog_type_id)
            references public.dog_types (id)
            on delete cascade;
    end if;
end;
$constraint$;
